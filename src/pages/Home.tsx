import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Vote, Shield, Zap, Users, ArrowRight, CheckCircle, Code, Lock, Wallet, FileText, ChevronRight, BarChart3, Settings, UserPlus } from 'lucide-react';
import Footer from '@/components/Footer';

const Home: React.FC = () => {
  const navigate = useNavigate();
  const [scrollY, setScrollY] = useState(0);
  const [isVisible, setIsVisible] = useState(false);
  
  // Refs for scroll animation sections
  const sectionsRef = useRef<(HTMLElement | null)[]>([]);

  // Track scroll position and handle reveal animations
  useEffect(() => {
    const handleScroll = () => {
      setScrollY(window.scrollY);
      
      // Check each section with reveal classes and activate animations when in viewport
      const revealElements = document.querySelectorAll('.reveal, .reveal-left, .reveal-right, .reveal-scale, .reveal-rotate, .reveal-blur');
      
      revealElements.forEach((element) => {
        const elementTop = element.getBoundingClientRect().top;
        const elementVisible = 150; // Adjust this value to change when the element becomes visible
        
        if (elementTop < window.innerHeight - elementVisible) {
          element.classList.add('active');
        } else {
          // Optional: remove the active class when scrolling back up
          // element.classList.remove('active');
        }
      });
    };

    window.addEventListener('scroll', handleScroll);
    
    // Trigger initial check for elements in viewport
    setTimeout(handleScroll, 100);
    
    return () => {
      window.removeEventListener('scroll', handleScroll);
    };
  }, []);

  // Set visibility after initial render for animations
  useEffect(() => {
    setIsVisible(true);
  }, []);

  // Calculate logo position and scale based on scroll
  const logoTransform = () => {
    // Maximum scroll value where animation completes (adjust as needed)
    const maxScroll = 400;
    
    // Calculate movement percentage (0 to 1)
    const scrollProgress = Math.min(scrollY / maxScroll, 1);
    
    // Calculate horizontal movement (px)
    const moveX = scrollProgress * 40;
    
    // Calculate vertical movement (px) - slight float effect
    const moveY = scrollProgress * -20;
    
    // Calculate scale reduction
    const scale = 1 - (scrollProgress * 0.12);
    
    // Calculate opacity reduction for subtle fade effect
    const opacity = 1 - (scrollProgress * 0.15);
    
    // Calculate rotation (degrees)
    const rotate = scrollProgress * 5;
    
    return {
      transform: `translate(${moveX}px, ${moveY}px) scale(${scale}) rotate(${rotate}deg)`,
      opacity: opacity,
      transition: 'transform 0.3s cubic-bezier(0.25, 0.1, 0.25, 1), opacity 0.3s cubic-bezier(0.25, 0.1, 0.25, 1)'
    };
  };

  const features = [
    {
      icon: <Zap className="w-8 h-8 text-white" />,
      title: 'Gas-Optimized',
      description: 'Ultra-efficient voting system with bitmap storage and meta-transactions for minimal gas costs.'
    },
    {
      icon: <Shield className="w-8 h-8 text-white" />,
      title: 'Private & Public',
      description: 'Support for both public polls and private whitelist-only voting with Merkle proofs.'
    },
    {
      icon: <Users className="w-8 h-8 text-white" />,
      title: 'Relayer Network',
      description: 'Gasless voting experience through authorized relayers with automatic reimbursement.'
    }
  ];

  const detailedFeatures = [
    {
      icon: <Code className="w-10 h-10 text-white" />,
      title: 'Optimized Smart Contracts',
      description: 'Our voting contracts are built with gas efficiency as the primary goal. We use bitmap storage patterns to minimize the gas cost of each vote, making participation affordable for everyone.',
      details: 'The contracts implement EIP-712 for typed structured data signing, allowing users to sign vote messages off-chain that can later be submitted by relayers.'
    },
    {
      icon: <Lock className="w-10 h-10 text-white" />,
      title: 'Private Voting Mechanism',
      description: 'For organizations that need controlled voting environments, our private voting system uses Merkle proofs to verify voter eligibility without storing the entire whitelist on-chain.',
      details: 'Administrators can generate a Merkle tree from a list of eligible voter addresses, and only the Merkle root is stored on-chain, significantly reducing deployment costs.'
    },
    {
      icon: <Wallet className="w-10 h-10 text-white" />,
      title: 'Gasless Voting Experience',
      description: 'Users can vote without paying for gas thanks to our meta-transaction architecture. The relayer network processes signed vote messages and submits them to the blockchain.',
      details: 'This approach removes the barrier of needing MATIC tokens to participate in governance, making the platform more accessible to all users.'
    },
    {
      icon: <BarChart3 className="w-10 h-10 text-white" />,
      title: 'Real-time Analytics',
      description: 'Track voting results in real-time with our advanced analytics dashboard. View participation rates, vote distribution, and historical trends.',
      details: 'The analytics system indexes blockchain events to provide instant updates without requiring constant on-chain queries, reducing infrastructure costs.'
    }
  ];

  const usageSteps = [
    {
      icon: <Wallet className="w-8 h-8 text-white" />,
      title: 'Connect Your Wallet',
      description: 'Click the "Connect Wallet" button in the top-right corner to connect your MetaMask or other Web3 wallet. This establishes a secure connection to the Polygon blockchain.',
      steps: [
        'Install MetaMask or another compatible wallet',
        'Ensure your wallet is configured for Polygon network',
        'Click "Connect Wallet" in the header',
        'Approve the connection request in your wallet'
      ]
    },
    {
      icon: <Vote className="w-8 h-8 text-white" />,
      title: 'Browse Available Polls',
      description: 'Explore active public polls or private polls you have access to. You can filter polls by category, status, or search for specific topics.',
      steps: [
        'Navigate to "Public Polls" or "Private Polls" section',
        'Use filters to narrow down your search',
        'Click on a poll to view details and candidates',
        'Check poll duration and eligibility requirements'
      ]
    },
    {
      icon: <CheckCircle className="w-8 h-8 text-white" />,
      title: 'Cast Your Vote',
      description: 'Select your preferred option and submit your vote. For public polls, you can vote directly. For private polls, your eligibility will be verified through Merkle proofs.',
      steps: [
        'Review all available candidates carefully',
        'Select your preferred option',
        'Sign the voting message in your wallet',
        'Wait for confirmation of your vote'
      ]
    },
    {
      icon: <FileText className="w-8 h-8 text-white" />,
      title: 'Create Your Own Poll',
      description: 'Create custom polls for your community or organization. Define candidates, set the duration, and choose between public or private voting modes.',
      steps: [
        'Click "Create Poll" in the navigation menu',
        'Fill in the poll details and candidates',
        'For private polls, upload the list of eligible voters',
        'Set the poll duration and finalize creation'
      ]
    }
  ];

  const technicalDetails = [
    {
      title: 'Smart Contract Architecture',
      content: 'ScrutinX uses two primary smart contracts: PublicVoting and PrivateVoting. Both implement the same core voting functionality but with different access control mechanisms. The contracts are designed to be minimal and focused, with gas optimization as a priority.'
    },
    {
      title: 'Meta-Transaction Implementation',
      content: 'Our meta-transaction system follows the EIP-712 standard for typed structured data signing. Users sign vote messages containing the poll ID, option ID, and their address. Relayers submit these signatures to the blockchain, covering the gas costs.'
    },
    {
      title: 'Merkle Proof Verification',
      content: 'For private polls, voter eligibility is verified using Merkle proofs. The poll creator generates a Merkle tree from the list of eligible addresses, and only the root is stored on-chain. When voting, users provide a proof that their address is part of the original list.'
    },
    {
      title: 'Bitmap Storage Pattern',
      content: 'To minimize storage costs, votes are stored in bitmap format. Each bit represents a voter\'s choice for a specific option, allowing us to store thousands of votes in just a few storage slots. This approach reduces gas costs by up to 90% compared to traditional voting systems.'
    }
  ];

  return (
    <div className="min-h-screen overflow-hidden">
      {/* Hero Section */}
      <section className="relative py-24 overflow-hidden bg-gradient-to-br from-[#E5DEFF] via-white to-[#E5DEFF]">
        {/* Subtle accent shapes */}
        <div className="absolute top-20 left-[10%] w-64 h-64 rounded-full bg-[#8B5CF6]/10 blur-3xl"></div>
        <div className="absolute bottom-20 right-[10%] w-72 h-72 rounded-full bg-[#6D28D9]/10 blur-3xl"></div>
        
        <div className="relative container mx-auto px-4 text-center">
          <div className={`transition-all duration-1000 ${isVisible ? 'opacity-100' : 'opacity-0'}`}>
            <div className="transition-all duration-300" style={logoTransform()}>
              <img 
                src="/ScrutinX.png" 
                alt="ScrutinX Logo" 
                className="w-48 h-48 mx-auto mb-8 object-contain filter drop-shadow-xl"
              />
            </div>
            <h1 className="text-4xl lg:text-6xl font-bold mb-6 animate-blur-in bg-clip-text text-transparent bg-gradient-to-r from-[#8B5CF6] to-[#6D28D9]">
                ScrutinX
            </h1>
            <p className="text-lg lg:text-xl text-[hsl(222.2,84%,4.9%)] mb-8 max-w-3xl mx-auto animate-slide-up font-light">
              Gas-Optimized, Public & Private Blockchain Voting on Polygon
            </p>
            <p className="text-base text-[hsl(222.2,47.4%,11.2%)] mb-12 max-w-2xl mx-auto animate-slide-up" style={{ animationDelay: "0.15s" }}>
              Experience the future of decentralized governance with our ultra-efficient voting platform. 
              Create polls, vote securely, and participate in the democratic process with minimal transaction costs.
            </p>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className="py-24 bg-white relative">
        <div className="container mx-auto px-4 max-w-6xl relative">
          <div className="text-center mb-16 reveal-blur">
            <h2 className="text-3xl font-bold mb-4 animate-blur-in bg-clip-text text-transparent bg-gradient-to-r from-[#8B5CF6] to-[#6D28D9]">
              Why Choose ScrutinX?
            </h2>
            <p className="text-lg text-[hsl(222.2,47.4%,11.2%)] max-w-2xl mx-auto animate-slide-up" style={{ animationDelay: "0.1s" }}>
              Built with cutting-edge blockchain technology to deliver the most efficient and secure voting experience.
            </p>
          </div>

          <div className="grid lg:grid-cols-3 gap-8">
            {features.map((feature, index) => (
              <Card 
                key={index} 
                className={`text-center border-none shadow-lg rounded-xl overflow-hidden hover:shadow-xl transition-all duration-300 bg-gradient-to-b from-white to-[hsl(210,40%,96.1%)] reveal ${index === 0 ? 'reveal-left' : index === 2 ? 'reveal-right' : 'reveal'} delay-${index * 200}`}
              >
                <CardHeader>
                  <div className="w-20 h-20 bg-gradient-to-br from-[#8B5CF6] to-[#6D28D9] rounded-2xl flex items-center justify-center mx-auto mb-6 shadow-md transform -rotate-6">
                    <div className="transform rotate-6">
                    {feature.icon}
                    </div>
                  </div>
                  <CardTitle className="text-xl font-bold text-[hsl(222.2,47.4%,11.2%)]">
                    {feature.title}
                  </CardTitle>
                </CardHeader>
                <CardContent className="px-6">
                  <p className="text-sm text-[hsl(222.2,47.4%,11.2%)/80]">
                    {feature.description}
                  </p>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* How It Works */}
      <section className="py-24 bg-gradient-to-br from-[#E5DEFF] via-white to-[#E5DEFF] relative overflow-hidden">
        {/* Subtle accent shapes */}
        <div className="absolute top-40 right-[5%] w-64 h-64 rounded-full bg-[#8B5CF6]/10 blur-3xl"></div>
        <div className="absolute bottom-40 left-[5%] w-80 h-80 rounded-full bg-[#6D28D9]/10 blur-3xl"></div>
        
        <div className="container mx-auto px-4 max-w-6xl relative">
          <div className="text-center mb-16 reveal-blur">
            <h2 className="text-3xl font-bold mb-4 animate-blur-in bg-clip-text text-transparent bg-gradient-to-r from-[#8B5CF6] to-[#6D28D9]">
              How It Works
            </h2>
            <p className="text-lg text-[hsl(222.2,47.4%,11.2%)] max-w-2xl mx-auto animate-slide-up" style={{ animationDelay: "0.1s" }}>
              Simple, secure, and efficient voting in just a few steps.
            </p>
          </div>

          <div className="grid lg:grid-cols-3 gap-8">
            {[
              {
                step: '01',
                title: 'Connect Wallet',
                description: 'Connect your MetaMask wallet to access the voting platform and interact with Polygon blockchain.'
              },
              {
                step: '02',
                title: 'Browse or Create',
                description: 'Explore active polls or create your own public or private poll with custom candidates and whitelist.'
              },
              {
                step: '03',
                title: 'Vote Securely',
                description: 'Cast your vote with gas-optimized transactions. Enjoy gasless voting through our relayer network.'
              }
            ].map((item, index) => (
              <div 
                key={index} 
                className={`text-center bg-white p-8 rounded-xl shadow-lg hover:shadow-xl transition-all duration-300 reveal delay-${index * 200}`}
              >
                <div className="w-16 h-16 bg-gradient-to-r from-[#8B5CF6] to-[#6D28D9] rounded-full flex items-center justify-center mx-auto mb-6 text-white text-xl font-bold shadow-md">
                  {item.step}
                </div>
                <h3 className="text-xl font-bold mb-3 text-[hsl(222.2,47.4%,11.2%)]">{item.title}</h3>
                <p className="text-sm text-[hsl(222.2,47.4%,11.2%)/80] px-2">{item.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Detailed Features Section */}
      <section className="py-24 bg-white relative">
        <div className="container mx-auto px-4 max-w-6xl relative">
          <div className="text-center mb-16 reveal-blur">
            <h2 className="text-3xl font-bold mb-4 animate-blur-in bg-clip-text text-transparent bg-gradient-to-r from-[#8B5CF6] to-[#6D28D9]">
              Advanced Features
            </h2>
            <p className="text-lg text-[hsl(222.2,47.4%,11.2%)] max-w-2xl mx-auto">
              Discover the powerful technology behind ScrutinX that makes it the most efficient voting platform on Polygon.
            </p>
          </div>

          <div className="space-y-24">
            {detailedFeatures.map((feature, index) => (
              <div key={index} className={`flex flex-col lg:flex-row gap-12 items-start ${index % 2 === 0 ? 'reveal-left' : 'reveal-right'} delay-${index * 100}`}>
                <div className={`${index % 2 === 0 ? 'order-none' : 'lg:order-last'} lg:w-1/3 flex justify-center mt-10`}>
                  <div className="w-40 h-40 rounded-3xl bg-gradient-to-br from-[#8B5CF6] to-[#6D28D9] flex items-center justify-center shadow-lg transform -rotate-6 hover:rotate-0 transition-all duration-300">
                    <div className="transform rotate-6 hover:rotate-0 transition-all duration-300">
                      {feature.icon}
                    </div>
                  </div>
                </div>
                
                <div className="lg:w-2/3">
                  <h3 className="text-2xl font-bold text-[hsl(222.2,47.4%,11.2%)] mb-4">{feature.title}</h3>
                  
                  <div className="bg-white rounded-xl shadow-sm border border-[hsl(210,40%,96.1%)] p-6 space-y-6">
                    <p className="text-base text-[hsl(222.2,47.4%,11.2%)] leading-relaxed">{feature.description}</p>
                    <p className="text-sm text-[hsl(222.2,47.4%,11.2%)/70] leading-relaxed">{feature.details}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Comprehensive Usage Guide */}
      <section className="py-24 bg-gradient-to-br from-[#E5DEFF] via-white to-[#E5DEFF] relative overflow-hidden">
        <div className="absolute inset-0 bg-grid-pattern opacity-10" />
        <div className="container mx-auto px-4 relative">
          <div className="text-center mb-16 reveal-blur">
            <h2 className="text-3xl font-bold mb-4 bg-clip-text text-transparent bg-gradient-to-r from-[#8B5CF6] to-[#6D28D9]">
              Complete User Guide
            </h2>
            <p className="text-lg text-[hsl(222.2,47.4%,11.2%)] max-w-2xl mx-auto">
              Follow our step-by-step guide to get started with ScrutinX and make the most of its features.
            </p>
          </div>

          <div className="grid md:grid-cols-2 gap-8">
            {usageSteps.map((step, index) => (
              <div 
                key={index} 
                className={`bg-white rounded-2xl shadow-xl overflow-hidden hover:shadow-2xl transition-all duration-300 transform hover:-translate-y-1 reveal delay-${index * 150}`}
              >
                <div className="bg-gradient-to-r from-[#8B5CF6] to-[#6D28D9] p-6">
                  <div className="flex items-center gap-4">
                    <div className="w-14 h-14 rounded-xl bg-white/20 backdrop-blur-md flex items-center justify-center shadow-inner">
                      {React.cloneElement(step.icon, { className: "w-7 h-7 text-white" })}
                    </div>
                    <div>
                      <div className="text-white/70 text-xs font-medium mb-1">Step {index + 1}</div>
                      <h3 className="text-xl font-bold text-white">{step.title}</h3>
                    </div>
                  </div>
                </div>
                
                <div className="p-6">
                  <p className="text-base text-[hsl(222.2,47.4%,11.2%)] mb-6 leading-relaxed">{step.description}</p>
                  
                  <div className="space-y-4 bg-[hsl(210,40%,96.1%)] p-5 rounded-xl">
                    <h4 className="font-semibold text-[hsl(222.2,47.4%,11.2%)] text-sm flex items-center">
                      <CheckCircle className="w-4 h-4 text-[#8B5CF6] mr-2" />
                      Quick Steps
                    </h4>
                    <div className="space-y-3">
                      {step.steps.map((substep, subindex) => (
                        <div key={subindex} className="flex items-start gap-3 group">
                          <div className="w-6 h-6 rounded-full bg-gradient-to-r from-[#8B5CF6] to-[#6D28D9] flex items-center justify-center flex-shrink-0 mt-0.5 shadow-md group-hover:scale-110 transition-transform">
                            <span className="text-white text-xs font-bold">{subindex + 1}</span>
                          </div>
                          <p className="text-[hsl(222.2,47.4%,11.2%)] text-sm pt-1 group-hover:text-[hsl(222.2,84%,4.9%)] transition-colors">{substep}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                  
                  <div className="mt-6 text-right">
                    <Button 
                      variant="ghost" 
                      className="text-[#8B5CF6] hover:text-[#8B5CF6]/80 hover:bg-[#8B5CF6]/5 flex items-center gap-1 text-xs font-medium"
                      onClick={() => navigate(index === 0 ? '/' : index === 1 ? '/polls' : index === 2 ? '/polls' : '/create')}
                    >
                      Learn more
                      <ChevronRight className="w-3 h-3" />
                    </Button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Technical Details Section */}
      <section className="py-24 bg-white">
        <div className="container mx-auto px-4 max-w-6xl">
          <div className="text-center mb-16 reveal-blur">
            <h2 className="text-3xl font-bold mb-4 bg-clip-text text-transparent bg-gradient-to-r from-[#8B5CF6] to-[#6D28D9]">
              Technical Architecture
            </h2>
            <p className="text-lg text-[hsl(222.2,47.4%,11.2%)] max-w-2xl mx-auto">
              Understand the technical foundations that make ScrutinX both secure and gas-efficient.
            </p>
          </div>

          <div className="grid md:grid-cols-2 gap-8">
            {technicalDetails.map((detail, index) => (
              <Card key={index} className={`border-none shadow-xl rounded-xl overflow-hidden hover:shadow-2xl transition-all duration-300 bg-gradient-to-b from-white to-[hsl(210,40%,96.1%)] reveal-scale delay-${index * 150}`}>
                <CardHeader className="border-b border-[hsl(210,40%,96.1%)] pb-4">
                  <CardTitle className="text-xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-[#8B5CF6] to-[#6D28D9]">
                    {detail.title}
                  </CardTitle>
                </CardHeader>
                <CardContent className="pt-6 px-8">
                  <p className="text-sm text-[hsl(222.2,47.4%,11.2%)] leading-relaxed">
                    {detail.content}
                  </p>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>
      
      {/* Footer - Only shown on Home page */}
      <Footer />

      <style>
        {`
          @keyframes slideUp {
            from {
              opacity: 0;
              transform: translateY(30px);
            }
            to {
              opacity: 1;
              transform: translateY(0);
            }
          }
          
          @keyframes slideInLeft {
            from {
              opacity: 0;
              transform: translateX(-50px);
            }
            to {
              opacity: 1;
              transform: translateX(0);
            }
          }
          
          @keyframes slideInRight {
            from {
              opacity: 0;
              transform: translateX(50px);
            }
            to {
              opacity: 1;
              transform: translateX(0);
            }
          }
          
          @keyframes blur-in {
            from {
              filter: blur(8px);
              opacity: 0;
            }
            to {
              filter: blur(0);
              opacity: 1;
            }
          }
        `}
      </style>
    </div>
  );
};

export default Home;
