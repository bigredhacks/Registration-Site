import { Link, SxProps, Theme } from '@mui/material';
import { styled } from '@mui/system';

interface CustomComponentProps {
  children: React.ReactNode;
  href: string;
  sx?: SxProps; // Add sx prop to handle custom styles
}

const LoginLinksStyling = styled(Link)(({ theme }) => ({
  display: "block", 
  marginTop: theme.spacing(1), 
  color: "#a55c4a",
}));

export default function LoginLinks({ children, href, sx }: CustomComponentProps) {
  return <LoginLinksStyling href={href} sx={sx}> {children}</LoginLinksStyling>;
}
