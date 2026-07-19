import React from 'react';
import { useDarkMode } from '../DarkModeContext';
import AuthLayout from '../features/auth/AuthLayout';
import LoginForm from '../features/auth/components/LoginForm';

const Landing = () => {
  const [dark] = useDarkMode();

  return (
    <AuthLayout 
      title="DJSCE Portal" 
      subtitle={
        <>
          Sign in to your account
          <br />
          Please select either admin or faculty based on your role.
        </>
      } 
      dark={dark}
    >
      <LoginForm />
    </AuthLayout>
  );
};

export default Landing;
