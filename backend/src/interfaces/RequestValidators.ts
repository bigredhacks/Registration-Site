import { ZodTypeAny } from "zod"

export default interface RequestValidator {
  params? : ZodTypeAny,
  body?: ZodTypeAny,
  query?: ZodTypeAny
}