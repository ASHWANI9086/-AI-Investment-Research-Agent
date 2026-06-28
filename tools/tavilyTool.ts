import axios from "axios";

export async function searchCompany(company: string) {
  const response = await axios.post(
    "https://api.tavily.com/search",
    {
      api_key: process.env.TAVILY_API_KEY,
      query: `${company} company analysis`,
      max_results: 5,
      search_depth: "advanced",
    }
  );

  return response.data;
}