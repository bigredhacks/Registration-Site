import { z } from "zod";

export const validDate = z
  .string()
  .transform((str) => new Date(str))
  .refine((date) => !isNaN(date.getTime()), { message: "Invalid date format" });

type ValidDate = z.infer<typeof validDate>;

export default ValidDate;