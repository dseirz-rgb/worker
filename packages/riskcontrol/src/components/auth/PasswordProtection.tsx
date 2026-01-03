import React, { useState, useEffect } from 'react';
import { Lock, ArrowRight } from 'lucide-react';
import { Card, Button, Input } from '../ui';
import { toast } from 'sonner';

interface PasswordProtectionProps {
  children: React.ReactNode;
}

export function PasswordProtection({ children }: PasswordProtectionProps) {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [password, setPassword] = useState('');
  const [errorMsg, setErrorMsg] = useState('');

  useEffect(() => {
    const sessionAuth = sessionStorage.getItem('riskcontrol_auth');
    if (sessionAuth === 'true') {
      setIsAuthenticated(true);
    }
  }, []);

  const handleLogin = (e?: React.FormEvent) => {
    e?.preventDefault();
    if (password === '523450') {
      setIsAuthenticated(true);
      sessionStorage.setItem('riskcontrol_auth', 'true');
      toast.success('验证通过');
      setErrorMsg('');
    } else {
      setErrorMsg('密码错误');
      toast.error('密码错误');
      setPassword('');
    }
  };

  if (isAuthenticated) {
    return <>{children}</>;
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <Card className="w-full max-w-md p-8">
        <div className="flex flex-col items-center text-center space-y-4 mb-8">
          <div className="w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center">
            <Lock size={32} className="text-primary" />
          </div>
          <div>
            <h1 className="text-2xl font-bold tracking-tight mb-2">访问受限</h1>
            <p className="text-muted-foreground text-sm">
              此区域包含敏感财务数据，请输入密码继续。
            </p>
          </div>
        </div>

        <form onSubmit={handleLogin} className="space-y-6">
          <div className="space-y-2">
            <Input
              type="password"
              placeholder="请输入访问密码"
              value={password}
              onChange={(e) => {
                setPassword(e.target.value);
                setErrorMsg('');
              }}
              error={errorMsg}
              autoFocus
            />
          </div>
          <Button type="submit" className="w-full flex items-center justify-center gap-2">
            解锁系统 <ArrowRight size={16} />
          </Button>
        </form>
      </Card>
    </div>
  );
}
