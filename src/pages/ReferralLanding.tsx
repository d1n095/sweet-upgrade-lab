import { useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { trackEvent } from '@/utils/analyticsTracker';

const ReferralLanding = () => {
  const { code } = useParams();
  const navigate = useNavigate();

  useEffect(() => {
    if (code) {
      // Store referral code in sessionStorage for attribution
      sessionStorage.setItem('referral_code', code);
      // Track the link click
      trackEvent('referral_click', { referral_code: code });
    }
    navigate('/', { replace: true });
  }, [code, navigate]);

  return null;
};

export default ReferralLanding;
