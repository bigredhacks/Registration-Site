"use client"; // Required for MUI in Next.js App Router

import { Container, Box, TextField, Button, Typography, Link, Paper } from "@mui/material";
import Image from "next/image";
import "@fontsource/poppins"; // Import Poppins font
import { Divider } from "@mui/material";



export default function LoginPage() {
  return (
    // 🔴 Background Gradient (Red Tone)
    <Box
      sx={{
        minHeight: "100vh",
        display: "flex",
        justifyContent: "center",
        alignItems: "center",
        background: "linear-gradient(to bottom, #E06A67 0%, #E8615D 35%, #E14743 75%)", // Matches soft red gradient
      }}
    >
      {/* 📝 White Login Card with Rounded Corners */}
      <Paper
        elevation={10}
        sx={{
          p: 4,
          borderRadius: 5, // Rounded corners
          width: 380,
          bgcolor: "#fdf7ed", // Soft cream background
          textAlign: "center",
        }}
      >
        {/* 🔺 Logo (Big Red Hacks) */}
        <Box sx={{ display: "flex", justifyContent: "center", mb: 2 }}>
          <Image src="/BRHLogo.png" alt="Big Red Hacks" width={140} height={60} />
        </Box>

        {/* 📄 Login Form */}
        <Box component="form" sx={{ mt: 2 }}>
          {/* 📧 Email Input Field */}
          <TextField
           fullWidth
           label="Email"
           variant="outlined"
           margin="normal"
           required
           sx={{
             bgcolor: "#fdf7ed", // ✅ Matches the login box's background color
             borderRadius: 2,
             "& .MuiOutlinedInput-root": { 
               borderRadius: 3, // ✅ Rounds the input field like the design
               "& fieldset": { borderColor: "#d6b8a9" }, // ✅ Light border similar to the design
               "&:hover fieldset": { borderColor: "#c9a89a" }, // ✅ Darker border on hover
               "&.Mui-focused fieldset": { borderColor: "#b88c7a" }, // ✅ Active input border
             },
           }}
          />
          
          {/* 🔒 Password Input Field */}
          <TextField
           fullWidth
           label="Password"
           variant="outlined"
           margin="normal"
           required
           sx={{
             bgcolor: "#fdf7ed", // ✅ Matches the login box's background color
             borderRadius: 2,
             "& .MuiOutlinedInput-root": { 
               borderRadius: 3, // ✅ Rounds the input field like the design
               "& fieldset": { borderColor: "#d6b8a9" }, // ✅ Light border similar to the design
               "&:hover fieldset": { borderColor: "#c9a89a" }, // ✅ Darker border on hover
               "&.Mui-focused fieldset": { borderColor: "#b88c7a" }, // ✅ Active input border
             },
           }}
          />

          {/* 🔗 "Forgot Password?" Link */}
          <Link href="#" sx={{ display: "block", mt: 1, mb: 2, fontSize: "14px", color: "#a55c4a" }}>
            Forgot Password?
          </Link>

          {/* 🔘 Red "Login" Button */}
          <Button
          fullWidth
          variant="contained"
          color="primary" // ✅ Uses theme color
          disableElevation
          sx={{
            mt: 2,
            width: "149px", // ✅ Matches Figma width
            height: "38px", // ✅ Matches Figma height
            fontSize: "16px", // ✅ Adjusts text size to match design
            py: 1.5, // ✅ Controls vertical padding
            fontWeight: "bold",
            backgroundColor: "#FE1736 !important", // ✅ Forces red background
            "&:hover": { backgroundColor: "#D92030 !important" }, // ✅ Darker red on hover
            borderRadius: 3, // ✅ Rounds the button like the design
          }}
        >
          Login
        </Button>
        </Box>

        {/* Horizontal Divider Line */}
        <Divider 
        sx={{ 
          mt: 2, // Adjust spacing above
          width: "50%", // ✅ Set width to 80% of the container (adjust if needed)
          height: "1px", // ✅ Keep it thin
          backgroundColor: "#6d4b3d", // ✅ Keeps the color consistent
          opacity: 0.5, // ✅ Lightens it for a subtle effect
          mx: "auto", // ✅ Centers the divider horizontally
        }} 
        />

        {/* 🔗 "Create Account" Link */}
        <Typography variant="body2" sx={{ mt: 2 }}>
          <Link href="#" sx={{ fontSize: "15px", color: "#6d4b3d" }}>
            Create Account
          </Link>
        </Typography>
      </Paper>
    </Box>
  );
}
