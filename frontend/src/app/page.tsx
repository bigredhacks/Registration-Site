"use client"; // Required for MUI in Next.js App Router
import { Container, Box, TextField, Button, Typography, Link, Paper} from "@mui/material";
import Image from "next/image";
import "@fontsource/poppins"; // Import Poppins font
import { Divider } from "@mui/material";
import LoginPaper from './mui-components/LoginPaper';
import PasswordInput from './mui-components/PasswordInput';
import EmailInput from './mui-components/EmailInput';
import SubmitButton from './mui-components/SubmitButton';
import LoginLink from './mui-components/LoginLink';

export default function LoginPage() {
  return (
    <Box 
    sx = {{
      minHeight: "100vh",
      display: "flex",
      justifyContent: "center",
      alignItems: "center",
      background: "linear-gradient(to bottom, #E06A67 0%, #E8615D 35%, #E14743 75%)"
    }}
    >
    <LoginPaper>
      <Box sx={{ display: "flex", justifyContent: "center", alignItems: "center", width: "100%" }}>
        {/* TODO: Resizable Image Capabilities?*/}
        <Image src="/BRHLogo.png" alt="Big Red Hacks" width={140} height={60} />
      </Box>

      <Box component="form">
        <EmailInput label="Email" />
        <PasswordInput/>

        <LoginLink href="#" sx={{fontSize: '14px'}} >
          Forgot Password?
        </LoginLink>

        <SubmitButton>
          Login
        </SubmitButton>
      </Box>

      <Divider 
        sx={{ 
          mt: 1, 
          mb: 1, 
          width: "50%", 
          height: "1px", 
          backgroundColor: "#6d4b3d",
          opacity: 0.5, 
          borderRadius: 1, 
          mx: "auto", 
        }} 
      />

      <LoginLink href="#" >
        Create Account
      </LoginLink>

    </LoginPaper>
    </Box>
  );
}
