import { PrismaClient } from "../generated/prisma/client";

const SERIALIZATION_FAILURE = "P2034";

export function isPrismaUniqueError(error: unknown): boolean {
  return typeof error === "object" && error !== null && "code" in error && error.code === "P2002";
}

export async function serializable<T>(
  prisma: PrismaClient,
  callback: (tx: PrismaClient) => Promise<T>,
): Promise<T> {
  for (let attempt = 0; ; attempt++) {
    try {
      return await prisma.$transaction((tx) => callback(tx as PrismaClient), {
        isolationLevel: "Serializable",
      });
    } catch (cause) {
      if (
        typeof cause === "object" &&
        cause !== null &&
        "code" in cause &&
        cause.code === SERIALIZATION_FAILURE &&
        attempt < 3
      )
        continue;
      throw cause;
    }
  }
}
