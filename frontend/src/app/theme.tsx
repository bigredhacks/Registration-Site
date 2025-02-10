import { createTheme } from "@mui/material/styles";
import "@fontsource/poppins"; // Import Poppins font

const theme = createTheme({
  typography: {
    fontFamily: "Poppins, sans-serif", // ✅ Sets Poppins as the default font
  },
  palette: {
    primary: {
      main: "#FE1736", // ✅ Forces all MUI primary buttons to be red
    },
  },
});

export default theme;