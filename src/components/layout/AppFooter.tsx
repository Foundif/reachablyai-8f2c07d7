import { useLocation } from 'react-router-dom';

const HIDDEN_ON = ['/inbox'];

const AppFooter = () => {
  const { pathname } = useLocation();
  if (HIDDEN_ON.includes(pathname)) return null;
  return null; // Footer removed per design — keep component for future use
};

export default AppFooter;
