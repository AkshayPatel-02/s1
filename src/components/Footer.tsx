import React from 'react';
import { Link } from 'react-router-dom';
import { 
  Github, 
  Twitter, 
  Linkedin, 
  MessageSquare,
  Mail, 
  ArrowUp,
  Shield,
  FileText,
  BookOpen,
  HelpCircle,
  Send
} from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { toast } from '@/hooks/use-toast';

const Footer: React.FC = () => {
  const scrollToTop = () => {
    window.scrollTo({
      top: 0,
      behavior: 'smooth'
    });
  };

  const handleSubscribe = (e: React.FormEvent) => {
    e.preventDefault();
    const form = e.target as HTMLFormElement;
    const email = form.email.value;
    
    // Here you would typically send this to your API
    console.log('Subscribing email:', email);
    
    toast({
      title: "Subscribed!",
      description: "You've been added to our newsletter.",
      variant: "success",
    });
    
    form.reset();
  };

  return (
    <footer className="bg-[#111827] text-gray-300 pt-12 pb-8 mt-12">
      <div className="container mx-auto px-6">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8 mb-8">
          {/* Logo & Tagline */}
          <div className="space-y-4">
            <div className="flex items-center">
              <img 
                src="/ScrutinX.png" 
                alt="ScrutinX Logo" 
                className="w-8 h-8 mr-2 object-contain"
              />
              <h3 className="text-xl font-bold text-white">ScrutinX</h3>
            </div>
            <p className="text-sm text-gray-400">
              Empowering transparent, secure, and private voting on the blockchain.
            </p>
            <button 
              onClick={scrollToTop}
              className="flex items-center text-sm text-gray-400 hover:text-white transition-colors"
            >
              <ArrowUp className="w-4 h-4 mr-1" />
              Back to top
            </button>
          </div>

          {/* Navigation */}
          <div>
            <h4 className="font-semibold text-white mb-4">Navigation</h4>
            <ul className="space-y-2">
              <li>
                <Link to="/" className="text-gray-400 hover:text-white text-sm transition-colors">
                  Home
                </Link>
              </li>
              <li>
                <Link to="/polls" className="text-gray-400 hover:text-white text-sm transition-colors">
                  Public Polls
                </Link>
              </li>
              <li>
                <Link to="/private-polls" className="text-gray-400 hover:text-white text-sm transition-colors">
                  Private Polls
                </Link>
              </li>
              <li>
                <Link to="/create" className="text-gray-400 hover:text-white text-sm transition-colors">
                  Create Poll
                </Link>
              </li>
              <li>
                <Link to="/dashboard" className="text-gray-400 hover:text-white text-sm transition-colors">
                  Dashboard
                </Link>
              </li>
            </ul>
          </div>

          {/* Resources */}
          <div>
            <h4 className="font-semibold text-white mb-4">Resources</h4>
            <ul className="space-y-2">
              <li>
                <a href="#" className="flex items-center text-gray-400 hover:text-white text-sm transition-colors">
                  <FileText className="w-4 h-4 mr-2" />
                  Documentation
                </a>
              </li>
              <li>
                <a href="#" className="flex items-center text-gray-400 hover:text-white text-sm transition-colors">
                  <BookOpen className="w-4 h-4 mr-2" />
                  API Reference
                </a>
              </li>
              <li>
                <Link to="/faq" className="flex items-center text-gray-400 hover:text-white text-sm transition-colors">
                  <HelpCircle className="w-4 h-4 mr-2" />
                  FAQ
                </Link>
              </li>
              <li>
                <a href="#" className="flex items-center text-gray-400 hover:text-white text-sm transition-colors">
                  <Shield className="w-4 h-4 mr-2" />
                  Security
                </a>
              </li>
            </ul>
          </div>

          {/* Connect */}
          <div>
            <h4 className="font-semibold text-white mb-4">Connect</h4>
            <div className="flex space-x-3 mb-4">
              <a 
                href="https://twitter.com" 
                target="_blank" 
                rel="noopener noreferrer"
                className="bg-[#1a2235] p-2 rounded-full hover:bg-[#2a334a] transition-colors"
                aria-label="Twitter"
              >
                <Twitter className="w-4 h-4 text-gray-300" />
              </a>
              <a 
                href="https://discord.com" 
                target="_blank" 
                rel="noopener noreferrer"
                className="bg-[#1a2235] p-2 rounded-full hover:bg-[#2a334a] transition-colors"
                aria-label="Discord"
              >
                <MessageSquare className="w-4 h-4 text-gray-300" />
              </a>
              <a 
                href="https://github.com" 
                target="_blank" 
                rel="noopener noreferrer"
                className="bg-[#1a2235] p-2 rounded-full hover:bg-[#2a334a] transition-colors"
                aria-label="GitHub"
              >
                <Github className="w-4 h-4 text-gray-300" />
              </a>
              <a 
                href="https://linkedin.com" 
                target="_blank" 
                rel="noopener noreferrer"
                className="bg-[#1a2235] p-2 rounded-full hover:bg-[#2a334a] transition-colors"
                aria-label="LinkedIn"
              >
                <Linkedin className="w-4 h-4 text-gray-300" />
              </a>
            </div>
            <a 
              href="mailto:support@scrutinx.com" 
              className="flex items-center text-gray-400 hover:text-white text-sm transition-colors mb-4"
            >
              <Mail className="w-4 h-4 mr-2" />
              support@scrutinx.com
            </a>
            
            {/* Newsletter Subscription */}
            <form onSubmit={handleSubscribe} className="mt-4">
              <h5 className="text-sm font-medium text-gray-300 mb-2">Subscribe to our newsletter</h5>
              <div className="flex">
                <Input 
                  type="email" 
                  name="email"
                  placeholder="Your email" 
                  required 
                  className="text-sm rounded-r-none bg-[#1a2235] border-[#2a334a] text-white focus-visible:ring-[#3b4664]"
                />
                <Button 
                  type="submit" 
                  size="sm"
                  className="rounded-l-none bg-[#3b4664] hover:bg-[#4a5780]"
                >
                  <Send className="w-4 h-4" />
                </Button>
              </div>
            </form>
          </div>
        </div>

        {/* Copyright & Legal */}
        <div className="border-t border-[#2a334a] pt-6 text-center">
          <p className="text-sm text-gray-400">
            &copy; {new Date().getFullYear()} ScrutinX. All rights reserved.
          </p>
          <div className="flex justify-center space-x-6 mt-2">
            <a href="#" className="text-xs text-gray-400 hover:text-white transition-colors">
              Privacy Policy
            </a>
            <a href="#" className="text-xs text-gray-400 hover:text-white transition-colors">
              Terms of Service
            </a>
            <a href="#" className="text-xs text-gray-400 hover:text-white transition-colors">
              Cookie Policy
            </a>
          </div>
        </div>
      </div>
    </footer>
  );
};

export default Footer; 