import { TextField } from "@mui/material";
import { styled } from "@mui/system";

const EmailInputDescription = styled(TextField)(({ theme }) => ({
  backgroundColor: "#fdf7ed", // Matches login box background
  borderRadius: theme.spacing(1), // Slight rounding
  "& .MuiOutlinedInput-root": {
    borderRadius: theme.spacing(1.5), // Rounds the input field
    "& fieldset": { borderColor: "#d6b8a9" }, // Light border
    "&:hover fieldset": { borderColor: "#c9a89a" }, // Darker border on hover
    "&.Mui-focused fieldset": { borderColor: "#b88c7a" }, // Active input border
  },
  "& .MuiFormLabel-asterisk": { color: "red" },
}));

export default function EmailInput(props: any) {
  return (
    <EmailInputDescription
      fullWidth
      label="Password"
      variant="outlined"
      margin="normal"
      required
      {...props}
    />
  );
}
