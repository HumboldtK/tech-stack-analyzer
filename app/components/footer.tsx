import React from 'react';

const Footer: React.FC = () => {
  return (
    <footer style={footerStyle}>
      <p style={textStyle}>
        Made By <a href="https://jacobmanus.com" style={linkStyle} target="_blank" rel="noopener noreferrer">Jacob M</a>
      </p>
    </footer>
  );
};

const footerStyle: React.CSSProperties = {
  position: 'fixed',
  bottom: 0,
  width: '100%',
  backgroundColor: '#f8f9fa',
  textAlign: 'center',
  padding: '1rem 0',
  boxShadow: '0 -1px 5px rgba(0, 0, 0, 0.1)',
};

const textStyle: React.CSSProperties = {
  margin: 0,
  fontSize: '1rem',
  color: '#343a40',
};

const linkStyle: React.CSSProperties = {
  color: '#007bff',
  textDecoration: 'none',
};

export default Footer;
