import { z } from "zod";

export type TokenSearchRequest = {
  query: string;
};

export type Token = {
  id: string;
  name: string;
  symbol: string;
  icon: string | null;
  decimals: number;
  tokenProgram: string;
  createdAt: string;
  updatedAt: string;
};

export type TokenSearchResponse = Token[];

const TokenSchema = z.object({
  id: z.string(),
  name: z.string(),
  symbol: z.string(),
  icon: z.string().nullable(),
  decimals: z.number(),
  tokenProgram: z.string(),
  createdAt: z.string(),
  updatedAt: z.string(),
});

const TokenSearchResponseSchema = z.array(TokenSchema);

export function createJupiterClient(apiKey: string, apiUrl: string) {
  return {
    async findToken(mint: string): Promise<Token> {
      const url = new URL(`${apiUrl}/tokens/v2/search`);
      url.searchParams.set("query", mint);
      const response = await fetch(url, { headers: { "x-api-key": apiKey } });
      if (!response.ok) throw new Error(`Jupiter returned HTTP ${response.status}.`);

      const parsed = TokenSearchResponseSchema.safeParse(await response.json());
      if (!parsed.success) throw new Error("Jupiter returned an invalid token response.");
      const token = parsed.data.find((candidate) => candidate.id === mint && candidate.symbol);
      if (!token) throw new Error("Jupiter returned no token for this mint.");
      return token;
    },
  };
}

export type JupiterClient = ReturnType<typeof createJupiterClient>;
