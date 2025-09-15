import React, { useState } from 'react';
import * as Sentry from '@sentry/react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { AlertCircle, Eye, EyeOff } from 'lucide-react';
import nvision_logo from '../assets/nvision_logo.png';
import { login } from '@/services/api';

interface LoginPageProps {
  onLogin: (token: string) => void;
}

type LoginFormProps = LoginPageProps & React.ComponentPropsWithoutRef<'div'>;

// Enhanced error types for better categorization
interface LoginError {
  type: 'validation' | 'authentication' | 'network' | 'server' | 'unknown';
  message: string;
  retryable: boolean;
}

export function LoginPage({
  onLogin,
  className,
  ...props
}: LoginFormProps) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<LoginError | null>(null);
  const [showPassword, setShowPassword] = useState(false);
  const [retryCount, setRetryCount] = useState(0);

  // Enhanced error classification
  const classifyError = (error: any): LoginError => {
    // Network errors
    if (!navigator.onLine) {
      return {
        type: 'network',
        message: 'No internet connection. Please check your network and try again.',
        retryable: true
      };
    }

    if (error.code === 'NETWORK_ERROR' || error.name === 'NetworkError') {
      return {
        type: 'network',
        message: 'Network error. Please check your connection and try again.',
        retryable: true
      };
    }

    // API response errors
    if (error.response) {
      const status = error.response.status;
      const detail = error.response.data?.detail;

      switch (status) {
        case 400:
          if (detail?.includes('credentials')) {
            return {
              type: 'authentication',
              message: 'Invalid username or password. Please check your credentials and try again.',
              retryable: false
            };
          }
          return {
            type: 'validation',
            message: 'Please check your input and try again.',
            retryable: false
          };

        case 401:
          return {
            type: 'authentication',
            message: 'Invalid username or password. Please verify your credentials.',
            retryable: false
          };

        case 403:
          return {
            type: 'authentication',
            message: 'Account access denied. Please contact support if this persists.',
            retryable: false
          };

        case 404:
          return {
            type: 'authentication',
            message: 'Account not found. Please check your username or contact support.',
            retryable: false
          };

        case 423:
          return {
            type: 'authentication',
            message: 'Account is temporarily locked. Please try again later or contact support.',
            retryable: true
          };

        case 429:
          return {
            type: 'server',
            message: 'Too many login attempts. Please wait a few minutes before trying again.',
            retryable: true
          };

        case 500:
        case 502:
        case 503:
        case 504:
          return {
            type: 'server',
            message: 'Server is temporarily unavailable. Please try again in a few moments.',
            retryable: true
          };

        default:
          return {
            type: 'unknown',
            message: `An error occurred (${status}). Please try again or contact support.`,
            retryable: true
          };
      }
    }

    // Timeout errors
    if (error.code === 'ECONNABORTED' || error.message?.includes('timeout')) {
      return {
        type: 'network',
        message: 'Request timed out. Please check your connection and try again.',
        retryable: true
      };
    }

    // Default fallback
    return {
      type: 'unknown',
      message: error.message || 'An unexpected error occurred. Please try again.',
      retryable: true
    };
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Clear previous errors
    setError(null);

    setIsLoading(true);

    try {
      const data = await login(username.trim(), password);
      
      // Success - store data securely
      localStorage.setItem('sentinel_dash_username', username.trim());
      localStorage.setItem('sentinel_dash_refresh', data.refresh);
      
      // Reset retry count on success
      setRetryCount(0);
      
      onLogin(data.access);
      
    } catch (error: any) {
      const classifiedError = classifyError(error);
      setError(classifiedError);
      
      // Increment retry count for retryable errors
      if (classifiedError.retryable) {
        setRetryCount(prev => prev + 1);
      }

      // Enhanced Sentry logging with error classification
      Sentry.captureException(error, {
        tags: {
          location: 'LoginPage',
          operation: 'user_login',
          error_type: classifiedError.type,
          retryable: classifiedError.retryable,
        },
        extra: {
          username: username.trim(),
          errorStatus: error.response?.status,
          retryCount: retryCount + 1,
          userAgent: navigator.userAgent,
          online: navigator.onLine,
        },
        level: classifiedError.type === 'server' ? 'warning' : 'error',
      });

      // Clear password on authentication errors for security
      if (classifiedError.type === 'authentication') {
        setPassword('');
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleRetry = () => {
    setError(null);
    setRetryCount(0);
  };

  return (
    <div className="grid h-screen pt-8 lg:grid-cols-2">
      <div className="relative hidden lg:block bg-[#6AA526]"></div>
      <div className="flex flex-col gap-4 p-6 md:p-10">
        <div className="flex justify-center gap-2 md:justify-start">
          <a href="#" className="flex items-center gap-2 font-medium">
            <div className="flex h-6 w-6 items-center justify-center rounded-md bg-primary text-primary-foreground">
              <img
                src={nvision_logo}
                className="size-6"
                alt="Nvision AI Logo"
              />
            </div>
            Nvision AI
          </a>
        </div>
        
        <div className="flex flex-1 items-center justify-center">
          <div className="w-full max-w-xs">
            <form
              className={cn('flex flex-col gap-6', className)}
              {...props}
              onSubmit={handleSubmit}
            >
              <div className="flex flex-col items-center gap-2 text-center">
                <h1 className="text-2xl font-bold">Login to your account</h1>
                <p className="text-balance text-sm text-muted-foreground">
                  Enter your credentials below to login to your account
                </p>
              </div>
              
              <div className="grid gap-6">
                <div className="grid gap-2">
                  <Label htmlFor="username">Username</Label>
                  <Input
                    id="username"
                    type="text"
                    autoComplete="username"
                    required
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    disabled={isLoading}
                    className={error?.type === 'validation' && !username.trim() ? 'border-red-500' : ''}
                  />
                </div>
                
                <div className="grid gap-2">
                  <Label htmlFor="password">Password</Label>
                  <div className="relative">
                    <Input
                      id="password"
                      type={showPassword ? 'text' : 'password'}
                      autoComplete="current-password"
                      required
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      disabled={isLoading}
                      className={error?.type === 'validation' && !password ? 'border-red-500' : ''}
                    />
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="absolute right-0 top-0 h-full px-3 py-2 hover:bg-transparent"
                      onClick={() => setShowPassword(!showPassword)}
                      disabled={isLoading}
                    >
                      {showPassword ? (
                        <EyeOff className="h-4 w-4" />
                      ) : (
                        <Eye className="h-4 w-4" />
                      )}
                    </Button>
                  </div>
                </div>

                {error && (
                  <Alert variant="destructive">
                    <AlertCircle className="h-4 w-4" />
                    <AlertDescription className="flex flex-col gap-2">
                      <span>{error.message}</span>
                      {error.retryable && retryCount >= 0 && (
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={handleRetry}
                          className="w-fit"
                        >
                          Try Again
                        </Button>
                      )}
                    </AlertDescription>
                  </Alert>
                )}

                <Button 
                  type="submit" 
                  className="w-full" 
                  disabled={isLoading || (error?.type === 'server' && retryCount > 2)}
                >
                  {isLoading ? 'Logging in...' : 'Login'}
                </Button>

                {retryCount > 2 && error?.type === 'server' && (
                  <p className="text-sm text-muted-foreground text-center">
                    Having trouble? Please contact support if this continues.
                  </p>
                )}
              </div>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
}