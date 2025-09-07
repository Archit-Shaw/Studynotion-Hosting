// server/controllers/Payments.js
const { instance } = require("../config/razorpay");
const Course = require("../models/Course");
const crypto = require("crypto");
const User = require("../models/User");
const mailSender = require("../utils/mailSender");
const mongoose = require("mongoose");
const { courseEnrollmentEmail } = require("../mail/templates/courseEnrollmentEmail");
const { paymentSuccessEmail } = require("../mail/templates/paymentSuccessEmail");
const CourseProgress = require("../models/CourseProgress");

// --------------------- Capture the payment and initiate Razorpay order ---------------------
exports.capturePayment = async (req, res) => {
  try {
    const { courses } = req.body;
    const userId = req.user.id;

    if (!courses || !Array.isArray(courses) || courses.length === 0) {
      return res.status(400).json({ success: false, message: "Please provide Course IDs" });
    }

    let total_amount = 0;

    for (const course_id of courses) {
      const course = await Course.findById(course_id);

      if (!course) {
        return res.status(404).json({ success: false, message: `Course not found: ${course_id}` });
      }

      // Ensure studentsEnrolled is always an array
      const studentsEnrolled = Array.isArray(course.studentsEnrolled) ? course.studentsEnrolled : [];

      const uid = new mongoose.Types.ObjectId(userId);
      if (studentsEnrolled.some((id) => id.equals(uid))) {
        return res.status(400).json({ success: false, message: "Already Enrolled in a course" });
      }

      if (!course.price) {
        return res.status(400).json({ success: false, message: "Course has no price" });
      }

      total_amount += course.price;
    }

    const options = {
      amount: total_amount * 100,
      currency: "INR",
      receipt: `receipt_${Date.now()}`,
      notes: { userId, courses: JSON.stringify(courses) },
    };

    const paymentResponse = await instance.orders.create(options);
    console.log("Razorpay Order Created:", paymentResponse);

    return res.status(200).json({
      success: true,
      data: paymentResponse,
    });
  } catch (error) {
    console.error("CAPTURE PAYMENT ERROR:", error);
    return res.status(500).json({ success: false, message: error.message });
  }
};

// --------------------- Verify the payment ---------------------
exports.verifyPayment = async (req, res) => {
  try {
    const { razorpay_order_id, razorpay_payment_id, razorpay_signature, courses } = req.body;
    const userId = req.user.id;

    if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature || !courses || !userId) {
      return res.status(400).json({ success: false, message: "Payment verification failed" });
    }

    const body = razorpay_order_id + "|" + razorpay_payment_id;

    const expectedSignature = crypto
      .createHmac("sha256", process.env.RAZORPAY_KEY_SECRET)
      .update(body.toString())
      .digest("hex");

    if (expectedSignature !== razorpay_signature) {
      return res.status(400).json({ success: false, message: "Invalid signature" });
    }

    await enrollStudents(courses, userId);
    return res.status(200).json({ success: true, message: "Payment Verified" });
  } catch (error) {
    console.error("VERIFY PAYMENT ERROR:", error);
    return res.status(500).json({ success: false, message: error.message });
  }
};

// --------------------- Send Payment Success Email ---------------------
exports.sendPaymentSuccessEmail = async (req, res) => {
  try {
    const { orderId, paymentId, amount } = req.body;
    const userId = req.user.id;

    if (!orderId || !paymentId || !amount || !userId) {
      return res.status(400).json({ success: false, message: "Missing payment details" });
    }

    const enrolledStudent = await User.findById(userId);
    if (!enrolledStudent) {
      return res.status(404).json({ success: false, message: "User not found" });
    }

    await mailSender(
      enrolledStudent.email,
      `Payment Received`,
      paymentSuccessEmail(
        `${enrolledStudent.firstName} ${enrolledStudent.lastName}`,
        amount / 100,
        orderId,
        paymentId
      )
    );

    return res.status(200).json({ success: true, message: "Email sent successfully" });
  } catch (error) {
    console.error("SEND PAYMENT EMAIL ERROR:", error);
    return res.status(500).json({ success: false, message: error.message });
  }
};

// --------------------- Enroll the student in courses ---------------------
const enrollStudents = async (courses, userId) => {
  for (const courseId of courses) {
    try {
      const enrolledCourse = await Course.findByIdAndUpdate(
        courseId,
        { $addToSet: { studentsEnrolled: userId } }, // $addToSet prevents duplicates
        { new: true }
      );

      if (!enrolledCourse) {
        console.warn(`Course not found: ${courseId}`);
        continue;
      }

      // Create course progress for student
      const courseProgress = await CourseProgress.create({
        courseID: courseId,
        userId,
        completedVideos: [],
      });

      // Update student record
      const enrolledStudent = await User.findByIdAndUpdate(
        userId,
        {
          $addToSet: { courses: courseId, courseProgress: courseProgress._id },
        },
        { new: true }
      );

      if (!enrolledStudent) {
        console.warn(`User not found: ${userId}`);
        continue;
      }

      // Send email
      await mailSender(
        enrolledStudent.email,
        `Successfully Enrolled into ${enrolledCourse.courseName}`,
        courseEnrollmentEmail(
          enrolledCourse.courseName,
          `${enrolledStudent.firstName} ${enrolledStudent.lastName}`
        )
      );

      console.log(`Enrolled ${enrolledStudent.email} in ${enrolledCourse.courseName}`);
    } catch (error) {
      console.error("ENROLLMENT ERROR:", error);
    }
  }
};
