import { z } from 'zod';
import { FormStatus } from '../types/formStatus';
import { formQuestionSchema } from './formQuestionSchema';

export const formLayoutSchema = z.object({
  title: z.string(),
  status: z.nativeEnum(FormStatus),
  description: z.string(),
  dueDate: z.date(),
  formQuestions: z.array(formQuestionSchema),
})

type FormLayout = z.infer<typeof formLayoutSchema>;

export default FormLayout;