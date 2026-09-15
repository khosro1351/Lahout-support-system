import { Button, Card, CardContent, Stack, Typography } from '@mui/material';
import { Link } from 'react-router-dom';
import { useAuth } from '../auth/AuthProvider';

export function HomePage() {
  const { user } = useAuth();
  return (
    <Stack spacing={2}>
      <Typography variant="h4" fontWeight={800}>خانه</Typography>
      <Card><CardContent>
        <Typography variant="h6">{user?.displayName}</Typography>
        <Typography color="text.secondary" sx={{ mt: 1 }}>
          نقش‌ها: {user?.roles.map((r) => r.roleCode).join('، ') || '—'}
        </Typography>
      </CardContent></Card>
      <Button component={Link} to="/families" variant="contained" sx={{ alignSelf: 'flex-start' }}>مشاهده خانواده‌ها</Button>
    </Stack>
  );
}
