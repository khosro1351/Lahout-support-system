import { AppBar, Box, Button, Container, Toolbar, Typography } from '@mui/material';
import { Link, Outlet } from 'react-router-dom';
import { useAuth } from '../auth/AuthProvider';

export function AppShell() {
  const { user, logout } = useAuth();
  return (
    <Box minHeight="100vh" bgcolor="grey.50">
      <AppBar position="static" color="inherit" elevation={1}>
        <Toolbar sx={{ gap: 2 }}>
          <Typography variant="h6" sx={{ flexGrow: 1 }}>کانون مهربانی همیاران لاهوت</Typography>
          <Button component={Link} to="/families">خانواده‌ها</Button>
          <Typography variant="body2">{user?.displayName}</Typography>
          <Button onClick={() => void logout()} color="error">خروج</Button>
        </Toolbar>
      </AppBar>
      <Container maxWidth="lg" sx={{ py: 3 }}>
        <Outlet />
      </Container>
    </Box>
  );
}
