import React from 'react';
import { useDarkMode } from '../DarkModeContext';
import AuthLayout from '../features/auth/AuthLayout';
import SignupForm from '../features/auth/components/SignupForm';

const Signup = () => {
  const [dark] = useDarkMode();

  return (
    <AuthLayout 
      title="Create an Account" 
      subtitle={
        <>
          Join the DJSCE Portal
          <br />
          Please select either admin or faculty based on your role.
        </>
      } 
      dark={dark}
    >
      <SignupForm />
    </AuthLayout>
  );
};

export default Signup;
