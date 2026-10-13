import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import { Loader2, Terminal } from 'lucide-react';
import { motion } from 'framer-motion';
import { authApi, errMsg } from '../api';
import { useAuth } from '../context/AuthContext';

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function Field({ k, label, type = 'text', auto, form, errors, set }) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-sm text-slate-400">{label}</span>
      <input className={`input ${errors[k] ? '!border-rose-500' : ''}`} type={type} value={form[k]} onChange={set(k)} autoComplete={auto} aria-invalid={!!errors[k]} />
      {errors[k] && <span className="mt-1 block text-xs text-rose-400">{errors[k]}</span>}
    </label>
  );
}

export default function AuthForm({ mode }) {
  const isReg = mode === 'register';
  const [form, setForm] = useState({ name: '', email: '', password: '' });
  const [errors, setErrors] = useState({});
  const [busy, setBusy] = useState(false);
  const { saveToken } = useAuth();
  const nav = useNavigate();

  const set = (k) => (e) => { setForm({ ...form, [k]: e.target.value }); setErrors({ ...errors, [k]: undefined }); };

  const validate = () => {
    const e = {};
    if (isReg && form.name.trim().length < 2) e.name = 'Enter your name.';
    if (!EMAIL.test(form.email)) e.email = 'Enter a valid email address.';
    if (form.password.length < (isReg ? 8 : 1)) e.password = isReg ? 'Use at least 8 characters.' : 'Enter your password.';
    setErrors(e);
    return !Object.keys(e).length;
  };

  const submit = async (ev) => {
    ev.preventDefault();
    if (!validate()) return toast.error('Fix the highlighted fields.');
    setBusy(true);
    try {
      const payload = isReg ? { name: form.name.trim(), email: form.email, password: form.password } : { email: form.email, password: form.password };
      const { data } = await (isReg ? authApi.register(payload) : authApi.login(payload));
      if (isReg && !(data?.access_token || data?.token)) {
        const res = await authApi.login({ email: form.email, password: form.password });
        await saveToken(res.data);
      } else await saveToken(data);
      toast.success(isReg ? 'Account created.' : 'Logged in.');
      nav('/dashboard');
    } catch (err) { toast.error(errMsg(err, isReg ? 'Could not create account.' : 'Could not log in.')); }
    finally { setBusy(false); }
  };

  const p = { form, errors, set };
  return (
    <div className="grid min-h-screen place-items-center px-4">
      <motion.form onSubmit={submit} noValidate initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} className="panel w-full max-w-sm space-y-4">
        <Link to="/" className="flex items-center gap-2 font-bold text-white"><Terminal size={18} className="text-indigo-400" />CP Dashboard</Link>
        <h1 className="text-xl font-bold text-white">{isReg ? 'Create your account' : 'Log in'}</h1>
        {isReg && <Field k="name" label="Name" auto="name" {...p} />}
        <Field k="email" label="Email" type="email" auto="email" {...p} />
        <Field k="password" label="Password" type="password" auto={isReg ? 'new-password' : 'current-password'} {...p} />
        <button className="btn w-full" disabled={busy}>{busy && <Loader2 size={16} className="animate-spin" />}{isReg ? 'Create account' : 'Log in'}</button>
        <p className="text-center text-sm text-slate-500">
          {isReg ? 'Already registered? ' : 'New here? '}
          <Link className="text-indigo-400 hover:underline" to={isReg ? '/login' : '/register'}>{isReg ? 'Log in' : 'Create an account'}</Link>
        </p>
      </motion.form>
    </div>
  );
}
