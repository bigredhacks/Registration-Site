import { TextField } from "@mui/material";
import { styled } from "@mui/system";

const PasswordInputDescription = styled(TextField)(({ theme }) => ({
  backgroundColor: "#fdf7ed", 
  borderRadius: theme.spacing(1), 
  "& .MuiOutlinedInput-root": {
    borderRadius: theme.spacing(1.5), 
    "& fieldset": { borderColor: "#d6b8a9" }, 
    "&:hover fieldset": { borderColor: "#c9a89a" }, 
    "&.Mui-focused fieldset": { borderColor: "#b88c7a" }, 
  },
   "& .MuiFormLabel-asterisk": { color: "red" },
}));

export default function PasswordInput(props: any) {
  return (
    <PasswordInputDescription
      fullWidth
      label="Password"
      variant="outlined"
      margin="normal"
      required
      type="password"
      {...props}
    />
  );
}
