import { Alert, Button, Card, CardActionArea, CardContent, CircularProgress, Stack, Typography } from '@mui/material';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { api } from '../api/client';

type FamilyRow = { id: string; family_code: string; status: string; head_name: string; head_mobile?: string; group_name: string; neighborhood?: string };

export function FamiliesPage() {
  const query = useQuery({ queryKey: ['families'], queryFn: () => api<FamilyRow[]>('/families') });
  return (
    <Stack spacing={2}>
      <Stack direction="row" justifyContent="space-between" alignItems="center">
        <Typography variant="h4" fontWeight={800}>خانواده‌ها</Typography>
        <Button component={Link} to="/families/new" variant="contained">ثبت خانواده</Button>
      </Stack>
      {query.isLoading && <CircularProgress />}
      {query.isError && <Alert severity="error">{query.error.message}</Alert>}
      {query.data?.length === 0 && <Alert severity="info">هنوز خانواده‌ای ثبت نشده است.</Alert>}
      {query.data?.map((f) => (
        <Card key={f.id} variant="outlined">
          <CardActionArea component={Link} to={`/families/${f.id}`}>
            <CardContent>
              <Typography variant="h6">{f.family_code} — {f.head_name}</Typography>
              <Typography color="text.secondary">گروه: {f.group_name} | محله: {f.neighborhood || '—'} | وضعیت: {f.status}</Typography>
            </CardContent>
          </CardActionArea>
        </Card>
      ))}
    </Stack>
  );
}
