import { Alert, Button, Card, CardContent, MenuItem, Stack, TextField, Typography } from '@mui/material';
import { FormEvent, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../api/client';

type Group = { id: string; code: string; name: string };

export function NewFamilyPage() {
  const navigate = useNavigate();
  const [groups, setGroups] = useState<Group[]>([]);
  const [form, setForm] = useState({ headFirstName: '', headLastName: '', mobile: '', nationalId: '', neighborhood: '', groupId: '' });
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    api<Group[]>('/groups').then((items) => {
      setGroups(items);
      if (items.length === 1) setForm((f) => ({ ...f, groupId: items[0].id }));
    }).catch((e) => setError(e.message));
  }, []);

  function field<K extends keyof typeof form>(key: K) {
    return { value: form[key], onChange: (e: React.ChangeEvent<HTMLInputElement>) => setForm({ ...form, [key]: e.target.value }) };
  }

  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true); setError('');
    try {
      const created = await api<{ id: string }>('/families', {
        method: 'POST',
        body: JSON.stringify({ ...form, mobile: form.mobile || undefined, nationalId: form.nationalId || undefined, neighborhood: form.neighborhood || undefined }),
      });
      navigate(`/families/${created.id}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'ثبت انجام نشد.');
    } finally { setBusy(false); }
  }

  return (
    <Card><CardContent>
      <Stack component="form" spacing={2} onSubmit={submit}>
        <Typography variant="h5" fontWeight={800}>ثبت خانواده جدید</Typography>
        {error && <Alert severity="error">{error}</Alert>}
        <TextField required label="نام سرپرست" {...field('headFirstName')} />
        <TextField required label="نام خانوادگی سرپرست" {...field('headLastName')} />
        <TextField label="موبایل" inputMode="numeric" {...field('mobile')} />
        <TextField label="کد ملی" inputMode="numeric" {...field('nationalId')} />
        <TextField label="محله" {...field('neighborhood')} />
        <TextField select required label="گروه" {...field('groupId')}>
          {groups.map((g) => <MenuItem key={g.id} value={g.id}>{g.name}</MenuItem>)}
        </TextField>
        <Button type="submit" variant="contained" size="large" disabled={busy}>{busy ? 'در حال ثبت...' : 'ثبت خانواده'}</Button>
      </Stack>
    </CardContent></Card>
  );
}
