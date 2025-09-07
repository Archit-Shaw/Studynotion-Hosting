import axios from "axios"

export const axiosInstance = axios.create({
    baseURL: "http://localhost:4000/api/v1", // optional, can simplify URLs
    withCredentials: true, // important if server uses cookies
    headers: {
        "Content-Type": "application/json",
    },
});

export const apiConnector = (method, url, bodyData, headers, params) => {
    return axiosInstance({
        method:`${method}`,
        url:`${url}`,
        data: bodyData ? bodyData : null,
        headers: headers || {},
        params: params ? params : null,
    });
}