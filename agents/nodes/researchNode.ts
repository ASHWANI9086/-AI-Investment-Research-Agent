import { searchCompany }
from "@/tools/tavilyTool";

export async function researchNode(
  state: any
) {
  const research =
    await searchCompany(
      state.company
    );

  return {
    ...state,
    research,
  };
}