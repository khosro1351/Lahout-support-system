import { Alert, Card, CardContent, CircularProgress, Stack, Typography } from '@mui/material';
import { useQuery } from '@tanstack/react-query';
import { useParams } from 'react-router-dom';
import { api } from '../api/client';

type FamilyDetail = {
  id: string; family_code: string; status: string; neighborhood?: string; group_name: string;
  first_name: string; last_name: string; mobile?: string; national_id?: string; created_at: string;
};

export function FamilyDetailPage() {
  const { id } = useParams();
  const query = useQuery({ queryKey: ['family', id], queryFn: () => api<FamilyDetail>(`/families/${id}`), enabled: !!id });
  if (query.isLoading) return <CircularProgress />;
  if (query.isError) return <Alert severity="error">{query.error.message}</Alert>;
  const f = query.data!;
  return (
    <Stack spacing={2}>
      <Typography variant="h4" fontWeight={800}>{f.family_code}</Typography>
      <Card><CardContent>
        <Stack spacing={1}>
          <Typography variant="h6">{f.first_name} {f.last_name}</Typography>
          <Typography>وضعیت: {f.status}</Typography>
          <Typography>گروه: {f.group_name}</Typography>
          <Typography>محله: {f.neighborhood || '—'}</Typography>
          <Typography>موبایل: {f.mobile || '—'}</Typography>
          <Typography>کد ملی: {f.national_id || '—'}</Typography>
        </Stack>
      </CardContent></Card>
    </Stack>
  );
}
