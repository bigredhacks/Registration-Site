import { Link, SxProps, Theme } from '@mui/material';
import { styled } from '@mui/system';

interface CustomComponentProps {
  children: React.ReactNode;
  href: string;
  sx?: SxProps<Theme>; // Add sx prop to handle custom styles
}

// Define styled component without directly setting href
const LoginLinks = styled(Link)(({ theme }) => ({
  display: "block", 
  marginTop: theme.spacing(1), 
  color: "#a55c4a",
}));

// The component where you define the href and accept sx
export default function CustomComponent({ children, href, sx }: CustomComponentProps) {
  return <LoginLinks href={href} sx={sx}>{children}</LoginLinks>;
}
