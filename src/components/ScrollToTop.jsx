import React, { useState, useEffect } from 'react';
import clsx from 'clsx';
import { FaArrowUp } from 'react-icons/fa';
import './ScrollToTop.css';

const ScrollToTop = () => {
  const [isVisible, setIsVisible] = useState(false);

  // Show button when page is scrolled down
  const toggleVisibility = () => {
    if (window.pageYOffset > 300) {
      setIsVisible(true);
    } else {
      setIsVisible(false);
    }
  };

  // Set the top cordinate to 0
  // make scrolling smooth
  const scrollToTop = () => {
    window.scrollTo({
      top: 0,
      behavior: 'smooth'
    });
  };

  useEffect(() => {
    window.addEventListener('scroll', toggleVisibility);
    
    // Initial check
    toggleVisibility();

    return () => {
      window.removeEventListener('scroll', toggleVisibility);
    };
  }, []);

  return (
    <div className="scroll-to-top-wrapper">
      <div 
        className={clsx('scroll-to-top', isVisible && 'visible')} 
        onClick={scrollToTop}
      >
        <div className="arrow-icon">
          <FaArrowUp size={20} />
        </div>
      </div>
    </div>
  );
};

export default ScrollToTop;
