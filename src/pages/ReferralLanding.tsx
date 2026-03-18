import { useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';

const ReferralLanding = () => {
  const { code } = useParams();
  const navigate = useNavigate();

  useEffect(() => {
    if (code) {
      // Store referral code in sessionStorage for post-purchase attribution
      sessionStorage.setItem('referral_code', code);
    }
    // Redirect to homepage
    navigate('/', { replace: true });
  }, [code, navigate]);

  return null;
};

export default ReferralLanding;
