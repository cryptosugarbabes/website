import type { Instrumentation } from "next";

export const onRequestError: Instrumentation.onRequestError = async (error, _request, context) => {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;
  const { reportApplicationError } = await import("@/lib/observability");
  await reportApplicationError(`server:${context.routeType}:${context.routePath}`, error);
};
