const nodemailer = require("nodemailer");

const mailSender = async (email, title, body) => {
  try {

    // 1. Configure the transporter
    let transporter = nodemailer.createTransport({
      host: process.env.MAIL_HOST,
      port: 465, 
      secure: true, 
      auth: {
        user: process.env.MAIL_USER,
        pass: process.env.MAIL_PASS,
      },
   
    });

   
    await transporter.verify();
    console.log("Transporter ready for sending.");

    
    let info = await transporter.sendMail({
      from: `"StudyNotion || - by Archit" <${process.env.MAIL_USER}>`,
      to: email,
      subject: title,
      html: body,
    });

    console.log("Email sent successfully:", info.messageId);
    return info;
  } catch (error) {
   
    console.error("Error while sending mail:", error);
    throw error;
  }
};

module.exports = mailSender;
