import { AnyZodObject } from "zod"

export default interface RequestValidator {
  params? : AnyZodObject,
  body?: AnyZodObject,
  query?: AnyZodObject,
}