import axios from "axios";

const API_BASE = "http://localhost:8000"; // Change if backend is hosted elsewhere

export const analyzeGoogleReviews = async (company_id, force_refresh = false) => {
  const res = await axios.post(
    `${API_BASE}/analyze/google/`,
    { force_refresh },
    {
      params: { company_id, force_refresh },
      timeout: 3000000 // 50 minutes
    }
  );
  return res.data;
};

