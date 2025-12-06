import axios from "axios";

const API_BASE = "http://localhost:8000"; // Change if backend is hosted elsewhere

export const analyzeGoogleReviews = async (company_id, force_refresh = false, review_count = null, userId = null, firmId = null) => {
  const params = { company_id, force_refresh, review_count };
  if (userId) params.userid = userId;
  if (firmId) params.firmid = firmId;
  
  const res = await axios.post(
    `${API_BASE}/analyze/google/`,
    { force_refresh, review_count, userid: userId, firmid: firmId },
    {
      params,
      timeout: 3000000 // 50 minutes
    }
  );
  return res.data;
};

export const updateCompanyGoogleUrl = async (company_id, google_url) => {
  const res = await axios.patch(
    `${API_BASE}/companies/${company_id}/google-url`,
    { google_url }
  );
  return res.data;
};

export const registerUser = async (userData, userId = null, firmId = null) => {
  const params = {};
  if (userId) params.userid = userId;
  if (firmId) params.firmid = firmId;
  
  const res = await axios.post(
    `${API_BASE}/register`,
    userData,
    { params }
  );
  return res.data;
};
