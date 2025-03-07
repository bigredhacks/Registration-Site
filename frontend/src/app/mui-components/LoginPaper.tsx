import { Paper } from '@mui/material';
import { styled } from '@mui/system';

const LoginPaper = styled(Paper)(({ theme }) => ({
  padding: theme.spacing(4), 
  borderRadius: 5, 
  width: 380,
  backgroundColor: '#fdf7ed',
  textAlign: 'center',
  boxShadow: '0px 6px 6px -3px rgba(0,0,0,0.2), 0px 10px 14px 1px rgba(0,0,0,0.14)',
  elevation: 10, 
  justifyContent: "center", 
}));

export default function CustomComponent({ children }: { children: React.ReactNode }) {
  return <LoginPaper>{children}</LoginPaper>; 
}
