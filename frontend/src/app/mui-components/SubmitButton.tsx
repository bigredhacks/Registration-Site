import { Button, Box } from '@mui/material';
import { styled } from '@mui/system';

const SubmitButtonStyle = styled(Button)(({ theme }) => ({
   '&.MuiButton-root': {
    backgroundColor: '#FE1736',
    margin: 10,
    padding: 2,
    width: "149px",
    height: "38px", 
    fontSize: "18px", 
    fontWeight: "bold",
    "&:hover": { backgroundColor: "#D92030" },
    borderRadius: theme.spacing(1.5),
  },
}));

export default function SubmitButton({ children }: { children: React.ReactNode }) {
  return (
    <Box sx={{ display: 'block', width: '100%',  }}>
      <SubmitButtonStyle
        fullWidth
        variant="contained"
        color="primary" 
        disableElevation
      >
        {children}
      </SubmitButtonStyle>
    </Box>
  );
}
