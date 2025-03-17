import { z } from 'zod';
import { FormStatus } from '../types/formStatus';
import { formQuestionSchema } from './formQuestionSchema';


// Full Schema for FormLayout (POST requests)
export const formLayoutSchema = z.object({
  title: z.string(),
  status: z.nativeEnum(FormStatus),
  description: z.string(),
  dueDate: z.date(),
  formQuestions: z.array(formQuestionSchema),
})

// Schema for PATCH requests (all fields optional)
export const formLayoutPatchSchema = formLayoutSchema.partial();

type FormLayout = z.infer<typeof formLayoutSchema>;

export default FormLayout;