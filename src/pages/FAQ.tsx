import React, { useState, useEffect } from 'react';
import { ChevronDown, ChevronUp, HelpCircle } from 'lucide-react';

const FAQ: React.FC = () => {
  const [openFaqIndex, setOpenFaqIndex] = useState<number | null>(null);
  const [filteredFaqs, setFilteredFaqs] = useState<typeof faqs>([]);
  const [isVisible, setIsVisible] = useState(false);
  const [activeCategory, setActiveCategory] = useState('all');

  // Scroll to top when component mounts
  useEffect(() => {
    window.scrollTo(0, 0);
  }, []);

  const categories = [
    { id: 'all', name: 'All Questions' },
    { id: 'general', name: 'General' },
    { id: 'technical', name: 'Technical' },
    { id: 'usage', name: 'Usage' }
  ];

  const faqs = [
    {
      question: 'What is gasless voting?',
      answer: 'Gasless voting allows users to vote without paying transaction fees (gas). With ScrutinX, you sign a message with your wallet, and our relayer network submits the transaction to the blockchain, covering the gas costs for you.',
      category: 'general'
    },
    {
      question: 'How do private polls work?',
      answer: 'Private polls restrict voting to a pre-defined list of eligible addresses. When creating a private poll, you designate a whitelist signer who authorizes eligible voters. Voters receive a cryptographic signature proving their eligibility, which they submit when voting. This approach ensures privacy and gas efficiency since only authorized voters can participate.',
      category: 'general'
    },
    {
      question: 'How do EIP-712 and whitelist verification work together in ScrutinX?',
      answer: 'In ScrutinX, we use two complementary technologies: EIP-712 is used for secure message signing (enabling gasless voting by signing vote intentions off-chain), while whitelist verification ensures only eligible voters can participate in private polls. When voting in a private poll, you first sign your vote using EIP-712 format, then provide a whitelist approval signature that proves your eligibility. This combination allows for both gasless and private voting while maintaining security.',
      category: 'technical'
    },
    {
      question: 'Is ScrutinX secure?',
      answer: 'Yes, ScrutinX is built with security as a priority. Our smart contracts have undergone thorough auditing, and we use cryptographically secure methods like EIP-712 signatures and whitelist verification to ensure the integrity of the voting process.',
      category: 'general'
    },
    {
      question: 'What blockchain does ScrutinX use?',
      answer: 'ScrutinX is built on Polygon (formerly Matic), a layer 2 scaling solution for Ethereum. This provides fast, low-cost transactions while maintaining security and compatibility with the Ethereum ecosystem.',
      category: 'technical'
    },
    {
      question: 'Can I integrate ScrutinX with my DAO or organization?',
      answer: 'Yes, ScrutinX is designed to be easily integrated with existing DAOs and organizations. We provide API access and customization options for enterprise clients. Contact our team for integration details.',
      category: 'usage'
    },
    {
      question: 'How does bitmap storage work?',
      answer: 'Bitmap storage is a gas-efficient way to store boolean values (like votes) on the blockchain. Instead of storing each vote as a separate entry, we use individual bits within larger integers to represent votes, significantly reducing gas costs for voting operations.',
      category: 'technical'
    },
    {
      question: 'What are whitelist approvals?',
      answer: 'Whitelist approvals are cryptographic signatures that verify a voter\'s eligibility to participate in a private poll. When a private poll is created, a whitelist signer is designated who can issue these approval signatures to eligible voters. When voting, users provide this signature to prove they\'re authorized to participate without revealing the entire list of eligible voters.',
      category: 'technical'
    },
    {
      question: 'How do I create a private poll?',
      answer: 'To create a private poll, go to the "Create Poll" page, fill in the poll details, select "Private Poll" as the type, and designate a whitelist signer address. This address will be responsible for approving eligible voters by providing them with cryptographic signatures that verify their eligibility.',
      category: 'usage'
    },
    {
      question: 'Is there a limit to how many options a poll can have?',
      answer: 'Public polls can have up to 32 options, while private polls can have up to 16 options due to gas optimization constraints. If you need more options, please contact our team for a custom solution.',
      category: 'usage'
    },
    {
      question: 'How long can a poll remain active?',
      answer: 'Polls can remain active for a duration set by the creator, from a minimum of 1 hour to a maximum of 30 days. Once the end time is reached, no more votes can be cast, but the results remain viewable indefinitely.',
      category: 'usage'
    },
    {
      question: 'Do I need MATIC tokens to vote?',
      answer: 'No, you don\'t need MATIC tokens to vote thanks to our gasless voting system. However, if you\'re creating a poll, you\'ll need a small amount of MATIC to cover the deployment costs of the smart contract.',
      category: 'general'
    },
    {
      question: 'Can I change my vote after submitting it?',
      answer: 'No, once a vote is submitted and recorded on the blockchain, it cannot be changed. This ensures the integrity and immutability of the voting process. Make sure to carefully review your selection before confirming your vote.',
      category: 'usage'
    },
    {
      question: 'How are the voting results calculated?',
      answer: 'Voting results are calculated in real-time directly from the blockchain. Each option\'s vote count is retrieved from the smart contract and displayed as both raw numbers and percentages. For weighted voting polls, the weight of each voter is taken into account when calculating the results.',
      category: 'technical'
    },
    {
      question: 'Is my vote anonymous?',
      answer: 'While your specific vote choice is not publicly linked to your wallet address, your participation in a poll is recorded on the blockchain. For applications requiring complete anonymity, we recommend using our zero-knowledge proof voting system which is available for enterprise clients.',
      category: 'general'
    },
    {
      question: 'What happens if the network is congested?',
      answer: 'Our relayer network is designed to handle network congestion by using optimal gas prices and retry mechanisms. In rare cases of extreme network congestion, there might be slight delays in vote confirmation, but your vote will be processed as soon as possible.',
      category: 'technical'
    },
    {
      question: 'Can I export voting results?',
      answer: 'Yes, poll creators can export voting results in various formats including CSV, JSON, and PDF. This feature is available from the poll details page after clicking on the "Export Results" button in the admin panel.',
      category: 'usage'
    },
    {
      question: 'How do I verify that my vote was counted?',
      answer: 'After voting, you\'ll receive a transaction hash that you can use to verify your vote on the blockchain. Additionally, in the "My Votes" section of your dashboard, you can see all polls you\'ve participated in and verify that your vote was correctly recorded.',
      category: 'usage'
    },
    {
      question: 'Does ScrutinX support weighted voting?',
      answer: 'Yes, ScrutinX supports weighted voting where different voters can have different voting power. This is particularly useful for DAOs and organizations where voting power is determined by token holdings or other metrics. This feature is available in both public and private polls.',
      category: 'technical'
    },
    {
      question: 'What is EIP-712 and how does ScrutinX use it?',
      answer: 'EIP-712 (Ethereum Improvement Proposal 712) is a standard for typed structured data hashing and signing in Ethereum. ScrutinX uses EIP-712 for our gasless voting system. When you vote, instead of submitting a transaction directly (which would cost gas), you sign a structured message containing your vote details (poll ID, option, etc.). This signature is cryptographically secure and can only be created by the owner of the wallet. Our relayer network then submits this signature to the blockchain, covering the gas costs. The smart contract verifies the signature to ensure it came from the claimed voter before recording the vote.',
      category: 'technical'
    },
    {
      question: 'What wallets are compatible with ScrutinX?',
      answer: 'ScrutinX is compatible with most Ethereum-compatible wallets that support the Polygon network and EIP-712 signing. This includes popular wallets like MetaMask, WalletConnect, Coinbase Wallet, Trust Wallet, and Ledger hardware wallets. For the best experience, we recommend using MetaMask or WalletConnect.',
      category: 'general'
    },
    {
      question: 'How do I become a whitelist signer for a private poll?',
      answer: 'To become a whitelist signer, you need to be designated by the poll creator during the poll creation process. As a whitelist signer, you\'ll be responsible for signing approval messages for eligible voters. We provide a dedicated admin interface for whitelist signers to easily manage voter approvals without requiring technical blockchain knowledge.',
      category: 'usage'
    },
    {
      question: 'Is there a fee for creating polls?',
      answer: 'Creating a poll requires a small amount of MATIC to cover the smart contract deployment costs. Additionally, poll creators need to deposit funds to cover the gas costs for voters (making the voting gasless for participants). The exact amount depends on the expected number of voters and current gas prices on Polygon. Enterprise customers can contact us for custom pricing plans with additional features.',
      category: 'general'
    },
    {
      question: 'Can I customize the appearance of my polls?',
      answer: 'Yes, ScrutinX offers customization options for polls. You can add your organization\'s logo, choose custom colors, and even embed polls on your own website. Advanced customization features are available for enterprise clients, including white-labeling options and custom domain integration.',
      category: 'usage'
    },
    {
      question: 'How does ScrutinX ensure the integrity of voting results?',
      answer: 'ScrutinX ensures voting integrity through several mechanisms: 1) All votes are recorded on the Polygon blockchain, making them immutable and transparent; 2) Smart contract code is open-source and audited; 3) EIP-712 signatures ensure that only the legitimate voter can cast their vote; 4) For private polls, whitelist verification ensures only eligible voters participate; 5) Real-time results are calculated directly from the blockchain data.',
      category: 'technical'
    }
  ];

  // Filter FAQs based on category
  useEffect(() => {
    const filtered = faqs.filter(faq => {
      return activeCategory === 'all' || faq.category === activeCategory;
    });
    setFilteredFaqs(filtered);
  }, [activeCategory]);

  // Set initial filtered FAQs and trigger entrance animation
  useEffect(() => {
    setFilteredFaqs(faqs);
    
    // Trigger entrance animations after a short delay
    setTimeout(() => {
      setIsVisible(true);
    }, 100);
  }, []);

  const toggleFaq = (index: number) => {
    if (openFaqIndex === index) {
      setOpenFaqIndex(null);
    } else {
      setOpenFaqIndex(index);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#E5DEFF] via-white to-[#E5DEFF] py-16">
      {/* Decorative elements */}
      <div className="absolute top-20 left-[10%] w-64 h-64 rounded-full bg-[#8B5CF6]/10 blur-3xl"></div>
      <div className="absolute bottom-20 right-[10%] w-72 h-72 rounded-full bg-[#6D28D9]/10 blur-3xl"></div>
      
      <div className="container mx-auto px-4 relative">
        <div className="max-w-4xl mx-auto">
          {/* Header with animation */}
          <div className={`transition-all duration-1000 transform ${isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 -translate-y-10'}`}>
            <div className="flex justify-center mb-6">
              <div className="bg-white rounded-full p-4 shadow-lg">
                <HelpCircle className="w-10 h-10 text-[#8B5CF6]" />
              </div>
            </div>
            <h1 className="text-4xl font-bold mb-4 text-center bg-clip-text text-transparent bg-gradient-to-r from-[#8B5CF6] to-[#6D28D9]">
              Frequently Asked Questions
            </h1>
            <p className="text-gray-600 text-center mb-8 max-w-2xl mx-auto">
              Find answers to common questions about ScrutinX and blockchain voting.
              If you can't find what you're looking for, please contact our support team.
            </p>
          </div>
          
          {/* Category filters */}
          <div className={`mb-8 transition-all duration-1000 delay-200 transform ${isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 -translate-y-10'}`}>
            <div className="flex flex-wrap gap-2 mb-6 justify-center">
              {categories.map((category, index) => (
                <button
                  key={category.id}
                  onClick={() => setActiveCategory(category.id)}
                  className={`px-4 py-2 rounded-full text-sm font-medium transition-all duration-300 ${
                    activeCategory === category.id
                      ? 'bg-[#8B5CF6] text-white shadow-md'
                      : 'bg-white text-gray-600 hover:bg-gray-100'
                  }`}
                  style={{ animationDelay: `${index * 100}ms` }}
                >
                  {category.name}
                </button>
              ))}
            </div>
          </div>
          
          {/* FAQ items */}
          <div className={`bg-white rounded-2xl shadow-xl p-8 mb-8 transition-all duration-1000 delay-300 transform ${isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-10'}`}>
            {filteredFaqs.length > 0 ? (
              <div className="space-y-6">
                {filteredFaqs.map((faq, index) => (
                  <div 
                    key={index} 
                    className={`border-b border-gray-200 pb-6 last:border-b-0 last:pb-0 transition-all duration-500 transform ${isVisible ? 'opacity-100 translate-x-0' : 'opacity-0 -translate-x-10'}`}
                    style={{ transitionDelay: `${300 + index * 100}ms` }}
                  >
                    <button 
                      className="flex justify-between items-center w-full text-left font-medium text-lg group"
                      onClick={() => toggleFaq(index)}
                    >
                      <span className="group-hover:text-[#8B5CF6] transition-colors duration-200">{faq.question}</span>
                      <div className={`rounded-full p-1 ml-4 transition-all duration-300 ${
                        openFaqIndex === index ? 'bg-[#8B5CF6]/10 rotate-0' : 'bg-[#F3F4F6] rotate-0'
                      }`}>
                        {openFaqIndex === index ? 
                          <ChevronUp className="w-5 h-5 text-[#8B5CF6] transition-transform duration-300 transform" /> : 
                          <ChevronDown className="w-5 h-5 text-gray-400 group-hover:text-[#8B5CF6] transition-all duration-300 transform" />
                        }
                      </div>
                    </button>
                    <div 
                      className={`mt-4 text-gray-600 transition-all duration-500 overflow-hidden ${
                        openFaqIndex === index ? 'max-h-[500px] opacity-100' : 'max-h-0 opacity-0'
                      }`}
                    >
                      <p className="bg-[#F9FAFB] p-6 rounded-lg leading-relaxed">{faq.answer}</p>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-10">
                <p className="text-gray-500">No questions found in this category</p>
                <button 
                  onClick={() => setActiveCategory('all')}
                  className="mt-4 text-[#8B5CF6] hover:underline"
                >
                  View all questions
                </button>
              </div>
            )}
          </div>
          
          {/* Contact section */}
          <div className={`text-center transition-all duration-1000 delay-500 transform ${isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-10'}`}>
            <div className="bg-gradient-to-r from-[#8B5CF6] to-[#6D28D9] rounded-xl p-8 shadow-xl">
              <h3 className="text-white text-xl font-bold mb-2">Still have questions?</h3>
              <p className="text-white/80 mb-6">Our support team is here to help you with any questions you may have.</p>
              <a 
                href="mailto:support@scrutinx.com" 
                className="inline-flex items-center justify-center bg-white text-[#8B5CF6] px-6 py-3 rounded-lg font-medium hover:bg-gray-50 transition-colors shadow-md"
              >
                Contact Support
              </a>
            </div>
          </div>
        </div>
      </div>
      
      {/* Animation styles */}
      <style>
        {`
          @keyframes fadeIn {
            from { opacity: 0; }
            to { opacity: 1; }
          }
          
          @keyframes slideUp {
            from { transform: translateY(20px); opacity: 0; }
            to { transform: translateY(0); opacity: 1; }
          }
          
          @keyframes pulse {
            0% { transform: scale(1); }
            50% { transform: scale(1.05); }
            100% { transform: scale(1); }
          }
        `}
      </style>
    </div>
  );
};

export default FAQ; 