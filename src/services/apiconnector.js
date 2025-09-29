import axios from "axios";

const BASE_URL = process.env.REACT_APP_BASE_URL; // <-- use env variable

export const axiosInstance = axios.create({
    baseURL: BASE_URL, // now uses the correct URL
    withCredentials: true,
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
