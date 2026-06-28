export async function GET() {
  return Response.json({
    groq: !!process.env.GROQ_API_KEY,
    tavily: !!process.env.TAVILY_API_KEY,
    massive: !!process.env.MASSIVE_API_KEY,
  });
}