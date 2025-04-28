import { z } from 'zod';
import { FormStatus } from '../../types/enums';
import { formQuestionSchema } from './formQuestionSchema';
import { validDate } from '../string-validation/validDate';


// Full Schema for FormLayout (POST requests)
export const formLayoutSchema = z.object({
  title: z.string(),
  status: z.nativeEnum(FormStatus),
  description: z.string().optional(),
  dueDate: validDate,
  formQuestions: z.array(formQuestionSchema),
})

// Schema for PATCH requests (all fields optional)
export const formLayoutPatchSchema = formLayoutSchema.partial();

type FormLayout = z.infer<typeof formLayoutSchema>;

export default FormLayout;