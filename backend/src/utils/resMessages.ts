export const errorMessage = (message: string) => {
  return { message: message}
}

export const serverErrorMessage = (err: any) => {
  return { message: err.message }
}

export const successMessage = (message: string) => {
  return { message: message } 
}