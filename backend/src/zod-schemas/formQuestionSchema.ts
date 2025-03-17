import { z } from 'zod';
import { QuestionType } from '../types/questionType';


export const formQuestionSchema = z.object({
  name: z.string(),
  required: z.boolean(),
  type: z.nativeEnum(QuestionType),
  defaultValue: z.string().optional(),
  options: z.array(z.string()).optional(),
  minLength: z.number().int().positive().optional(),
  maxLength: z.number().int().positive().optional(),
})

type FormQuestion = z.infer<typeof formQuestionSchema>;

export default FormQuestion;