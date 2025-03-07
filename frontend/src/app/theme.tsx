import { createTheme } from "@mui/material/styles";
import "@fontsource/poppins"; // Import Poppins font

const theme = createTheme({
  typography: {
    fontFamily: "Poppins, sans-serif", 
  },
  components: {
    MuiButton: {
      styleOverrides: {
        root: {
          borderRadius: "8px", // Default border-radius for all buttons
          textTransform: "none", // Remove default uppercase text
        },
      },
    },
  },
});

export default theme;