import React, { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import './App.css';

const API_BASE_URL = process.env.REACT_APP_BACKEND_URL || 'http://localhost:8001';

// Move components outside to prevent re-creation on every render
const ScoreBar = React.memo(({ score, label, color = "blue" }) => (
  <div className="mb-4">
    <div className="flex justify-between items-center mb-1">
      <span className="text-sm font-medium text-gray-700">{label}</span>
      <span className="text-sm font-semibold text-gray-900">{Math.round(score || 0)}/100</span>
    </div>
    <div className="w-full bg-gray-200 rounded-full h-2">
      <div 
        className={`h-2 rounded-full bg-${color}-500 transition-all duration-500`}
        style={{ width: `${Math.min(score || 0, 100)}%` }}
      ></div>
    </div>
  </div>
));

const InfoCard = React.memo(({ title, children, icon, color = "blue" }) => (
  <div className="bg-white rounded-xl shadow-lg border border-gray-100 overflow-hidden">
    <div className={`bg-gradient-to-r from-${color}-500 to-${color}-600 px-6 py-4`}>
      <div className="flex items-center">
        <div className="text-white text-2xl mr-3">{icon}</div>
        <h3 className="text-xl font-bold text-white">{title}</h3>
      </div>
    </div>
    <div className="p-6">
      {children}
    </div>
  </div>
));

const TabButton = React.memo(({ tab, label, active, onClick }) => (
  <button
    onClick={() => onClick(tab)}
    className={`px-6 py-3 font-semibold rounded-lg transition-all ${
      active
        ? 'bg-blue-500 text-white shadow-lg'
        : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
    }`}
  >
    {label}
  </button>
));

const MethodSelector = React.memo(({ label, value, onChange, options, description }) => (
  <div className="bg-gray-50 rounded-lg p-4">
    <label className="block text-sm font-semibold text-gray-700 mb-2">
      {label}
    </label>
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
    >
      {options.map((option, index) => (
        <option key={`${option.value}-${index}`} value={option.value}>
          {option.label}
        </option>
      ))}
    </select>
    {description && (
      <p className="text-xs text-gray-500 mt-1">{description}</p>
    )}
  </div>
));

function App() {
  const [formData, setFormData] = useState({
    businessName: '',
    businessCount: 1,
    businessCategory: '',
    businessSubcategory: '',
    country: '',
    state: '',
    city: '',
    area: '',
    techStackMethod: 'both',
    websiteAnalysisMethod: 'both',
    generateOutreach: false
  });
  
  const [loading, setLoading] = useState(false);
  const [analysis, setAnalysis] = useState(null);
  const [error, setError] = useState('');
  const [analysisHistory, setAnalysisHistory] = useState([]);
  const [activeTab, setActiveTab] = useState('analyzer');

  useEffect(() => {
    fetchAnalysisHistory();
  }, []);

  const fetchAnalysisHistory = useCallback(async () => {
    try {
      const response = await axios.get(`${API_BASE_URL}/api/analyses`);
      if (response.data.success) {
        setAnalysisHistory(response.data.data);
      }
    } catch (error) {
      console.error('Failed to fetch analysis history:', error);
    }
  }, []);

  const handleInputChange = useCallback((field, value) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }));
  }, []);

  const handleAnalyze = async (e) => {
    e.preventDefault();
    
    if (!formData.businessName.trim()) {
      setError('Please enter a business name');
      return;
    }

    if (formData.businessCount < 1 || formData.businessCount > 10) {
      setError('Number of businesses must be between 1 and 10');
      return;
    }

    setLoading(true);
    setError('');
    setAnalysis(null);

    // Build location string
    const locationParts = [formData.area, formData.city, formData.state, formData.country].filter(part => part.trim());
    const fullLocation = locationParts.join(', ');

    try {
      const response = await axios.post(`${API_BASE_URL}/api/analyze-business`, {
        business_name: formData.businessName.trim(),
        business_count: formData.businessCount,
        business_category: formData.businessCategory.trim() || null,
        business_subcategory: formData.businessSubcategory.trim() || null,
        location: fullLocation || null,
        analysis_options: {
          tech_stack_method: formData.techStackMethod,
          website_analysis_method: formData.websiteAnalysisMethod,
          generate_outreach: formData.generateOutreach
        }
      });

      if (response.data.success) {
        setAnalysis(response.data.data);
        await fetchAnalysisHistory(); // Refresh history
      } else {
        setError('Analysis failed. Please try again.');
      }
    } catch (error) {
      setError(`Analysis failed: ${error.response?.data?.detail || error.message}`);
      console.error('Analysis error:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadAnalysis = async (analysisId) => {
    try {
      const response = await axios.get(`${API_BASE_URL}/api/analysis/${analysisId}`);
      if (response.data.success) {
        setAnalysis(response.data.data);
        setActiveTab('analyzer');
      }
    } catch (error) {
      setError('Failed to load analysis');
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50">
      {/* Header */}
      <header className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-6 py-4">
          <h1 className="text-3xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
            🚀 AI Business Intelligence Tool
          </h1>
          <p className="text-gray-600 mt-1">
            Comprehensive business analysis and digital marketing insights powered by AI
          </p>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-6 py-8">
        {/* Navigation Tabs */}
        <div className="flex space-x-4 mb-8">
          <TabButton 
            tab="analyzer" 
            label="🔍 Business Analyzer" 
            active={activeTab === 'analyzer'} 
            onClick={setActiveTab}
          />
          <TabButton 
            tab="history" 
            label="📊 Analysis History" 
            active={activeTab === 'history'} 
            onClick={setActiveTab}
          />
        </div>

        {/* Analyzer Tab */}
        {activeTab === 'analyzer' && (
          <div className="space-y-8">
            {/* Analysis Form */}
            <InfoCard title="Business Analysis Configuration" icon="🎯" color="blue">
              <form onSubmit={handleAnalyze} className="space-y-6">
                
                {/* Basic Business Information */}
                <div className="grid md:grid-cols-2 gap-6">
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">
                      Business Name *
                    </label>
                    <input
                      type="text"
                      name="businessName"
                      value={formData.businessName}
                      onChange={(e) => handleInputChange('businessName', e.target.value)}
                      placeholder="Enter business name (e.g., 'Wedding Makeover Studio')"
                      className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      required
                      autoComplete="off"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">
                      Number of Business Details Needed
                    </label>
                    <input
                      type="number"
                      name="businessCount"
                      min="1"
                      max="10"
                      value={formData.businessCount}
                      onChange={(e) => handleInputChange('businessCount', parseInt(e.target.value) || 1)}
                      className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      autoComplete="off"
                    />
                    <p className="text-xs text-gray-500 mt-1">How many similar businesses to analyze (1-10)</p>
                  </div>
                </div>

                {/* Business Categories */}
                <div className="grid md:grid-cols-2 gap-6">
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">
                      Business Category
                    </label>
                    <input
                      type="text"
                      name="businessCategory"
                      value={formData.businessCategory}
                      onChange={(e) => handleInputChange('businessCategory', e.target.value)}
                      placeholder="e.g., 'Makeup Artist', 'Restaurant', 'Consulting'"
                      className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      autoComplete="off"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">
                      Subcategory (Optional)
                    </label>
                    <input
                      type="text"
                      name="businessSubcategory"
                      value={formData.businessSubcategory}
                      onChange={(e) => handleInputChange('businessSubcategory', e.target.value)}
                      placeholder="e.g., 'Bridal Makeup', 'Fine Dining', 'Management Consulting'"
                      className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      autoComplete="off"
                    />
                  </div>
                </div>

                {/* Detailed Location */}
                <div>
                  <h4 className="text-lg font-semibold text-gray-800 mb-3">Location Details (All Optional)</h4>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Country</label>
                      <input
                        type="text"
                        name="country"
                        value={formData.country}
                        onChange={(e) => handleInputChange('country', e.target.value)}
                        placeholder="USA, UK, India..."
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        autoComplete="country"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">State/Province</label>
                      <input
                        type="text"
                        name="state"
                        value={formData.state}
                        onChange={(e) => handleInputChange('state', e.target.value)}
                        placeholder="NY, CA, London..."
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        autoComplete="address-level1"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">City</label>
                      <input
                        type="text"
                        name="city"
                        value={formData.city}
                        onChange={(e) => handleInputChange('city', e.target.value)}
                        placeholder="New York, Los Angeles..."
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        autoComplete="address-level2"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Area/District</label>
                      <input
                        type="text"
                        name="area"
                        value={formData.area}
                        onChange={(e) => handleInputChange('area', e.target.value)}
                        placeholder="Manhattan, Downtown..."
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        autoComplete="address-level3"
                      />
                    </div>
                  </div>
                </div>

                {/* Analysis Method Selection */}
                <div>
                  <h4 className="text-lg font-semibold text-gray-800 mb-4">Analysis Method Preferences</h4>
                  <div className="grid md:grid-cols-2 gap-6">
                    
                    <MethodSelector
                      label="Technology Stack Detection"
                      value={formData.techStackMethod}
                      onChange={(value) => handleInputChange('techStackMethod', value)}
                      options={[
                        { value: 'both', label: '🔄 Both API + Custom Analysis (Recommended)' },
                        { value: 'api', label: '🌐 API-Based Detection Only' },
                        { value: 'custom', label: '🛠️ Custom Built Analysis Only' }
                      ]}
                      description="Choose how to detect website technologies and tools"
                    />

                    <MethodSelector
                      label="Website Performance Analysis"
                      value={formData.websiteAnalysisMethod}
                      onChange={(value) => handleInputChange('websiteAnalysisMethod', value)}
                      options={[
                        { value: 'both', label: '🔄 Google APIs + Custom Analysis (Recommended)' },
                        { value: 'google_apis', label: '📊 Google APIs Only (PageSpeed, Search Console)' },
                        { value: 'custom', label: '🛠️ Custom Built Analysis Only' }
                      ]}
                      description="Choose method for SEO and performance analysis"
                    />

                  </div>
                </div>

                {/* Outreach Email Generation */}
                <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                  <div className="flex items-center">
                    <input
                      type="checkbox"
                      id="generateOutreach"
                      checked={formData.generateOutreach}
                      onChange={(e) => handleInputChange('generateOutreach', e.target.checked)}
                      className="w-4 h-4 text-blue-600 bg-gray-100 border-gray-300 rounded focus:ring-blue-500"
                    />
                    <label htmlFor="generateOutreach" className="ml-3 text-sm font-medium text-gray-700">
                      📧 Generate Personalized Outreach Email
                    </label>
                  </div>
                  <p className="text-xs text-gray-600 mt-2 ml-7">
                    Check this if you want AI to create a personalized outreach email with subject line and intro based on the analysis
                  </p>
                </div>

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full bg-gradient-to-r from-blue-500 to-purple-600 text-white font-bold py-4 px-6 rounded-lg hover:from-blue-600 hover:to-purple-700 transition-all duration-300 transform hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none"
                >
                  {loading ? (
                    <div className="flex items-center justify-center">
                      <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-white mr-3"></div>
                      Analyzing Business... (This may take 30-90 seconds)
                    </div>
                  ) : (
                    '🔍 Start Business Intelligence Analysis'
                  )}
                </button>

                {error && (
                  <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                    <div className="flex">
                      <div className="text-red-400 text-xl mr-3">⚠️</div>
                      <div>
                        <h4 className="text-red-800 font-semibold">Analysis Error</h4>
                        <p className="text-red-700">{error}</p>
                      </div>
                    </div>
                  </div>
                )}
              </form>
            </InfoCard>

            {/* Analysis Results */}
            {analysis && (
              <div className="space-y-8">
                
                {/* Business Information */}
                <InfoCard title="📋 Business Profile & Contact Information" icon="🏢" color="green">
                  <div className="grid md:grid-cols-2 gap-6">
                    
                    {/* Primary Business Info */}
                    <div>
                      <h4 className="font-semibold text-gray-800 mb-3">📞 Contact Information</h4>
                      {analysis.business_info?.processed_data && !analysis.business_info.processed_data.error ? (
                        <div className="space-y-3">
                          <div className="bg-gray-50 rounded-lg p-3">
                            <div className="flex items-center mb-2">
                              <span className="text-lg mr-2">🏢</span>
                              <strong>Business Name:</strong>
                            </div>
                            <p className="ml-6 text-gray-700">{analysis.business_info.processed_data.business_name || 'Not found'}</p>
                          </div>
                          
                          <div className="bg-gray-50 rounded-lg p-3">
                            <div className="flex items-center mb-2">
                              <span className="text-lg mr-2">📧</span>
                              <strong>Email:</strong>
                            </div>
                            <p className="ml-6 text-gray-700">{analysis.business_info.processed_data.email || 'Not found'}</p>
                          </div>
                          
                          <div className="bg-gray-50 rounded-lg p-3">
                            <div className="flex items-center mb-2">
                              <span className="text-lg mr-2">📞</span>
                              <strong>Phone:</strong>
                            </div>
                            <p className="ml-6 text-gray-700">{analysis.business_info.processed_data.phone || 'Not found'}</p>
                          </div>
                          
                          <div className="bg-gray-50 rounded-lg p-3">
                            <div className="flex items-center mb-2">
                              <span className="text-lg mr-2">🌐</span>
                              <strong>Website:</strong>
                            </div>
                            <div className="ml-6">
                              {analysis.business_info.processed_data.website ? (
                                <a href={analysis.business_info.processed_data.website} target="_blank" rel="noopener noreferrer" className="text-blue-500 hover:underline break-all">
                                  {analysis.business_info.processed_data.website}
                                </a>
                              ) : (
                                <span className="text-gray-700">Not found</span>
                              )}
                            </div>
                          </div>
                          
                          <div className="bg-gray-50 rounded-lg p-3">
                            <div className="flex items-center mb-2">
                              <span className="text-lg mr-2">📍</span>
                              <strong>Address:</strong>
                            </div>
                            <p className="ml-6 text-gray-700">{analysis.business_info.processed_data.address || 'Not found'}</p>
                          </div>
                          
                          {analysis.business_info.processed_data.description && (
                            <div className="bg-blue-50 rounded-lg p-3">
                              <div className="flex items-center mb-2">
                                <span className="text-lg mr-2">📄</span>
                                <strong>Description:</strong>
                              </div>
                              <p className="ml-6 text-gray-700">{analysis.business_info.processed_data.description}</p>
                            </div>
                          )}
                          
                          {analysis.business_info.processed_data.confidence_score && (
                            <div className="mt-4">
                              <ScoreBar 
                                score={analysis.business_info.processed_data.confidence_score * 100}
                                label="Data Accuracy Confidence"
                                color="green"
                              />
                            </div>
                          )}
                        </div>
                      ) : (
                        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                          <p className="text-yellow-800">
                            <strong>⚠️ Business information extraction in progress or limited data available.</strong>
                          </p>
                          {analysis.business_info?.processed_data?.error && (
                            <p className="text-yellow-700 mt-2">Error: {analysis.business_info.processed_data.error}</p>
                          )}
                        </div>
                      )}
                    </div>

                    {/* LinkedIn & Social Media */}
                    <div>
                      <h4 className="font-semibold text-gray-800 mb-3">🔗 Social Media Presence</h4>
                      
                      {/* LinkedIn */}
                      {analysis.linkedin_profile?.linkedin_profiles?.length > 0 ? (
                        <div className="space-y-3">
                          <h5 className="font-medium text-gray-700">LinkedIn Profiles Found:</h5>
                          {analysis.linkedin_profile.linkedin_profiles.map((profile, idx) => (
                            <div key={idx} className="border-l-4 border-blue-500 bg-blue-50 pl-4 py-2 rounded">
                              <a href={profile.url} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline font-medium block">
                                {profile.title}
                              </a>
                              <p className="text-sm text-gray-600 mt-1">{profile.snippet}</p>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <div className="bg-gray-50 rounded-lg p-4">
                          <p className="text-gray-600">🔍 LinkedIn profile not found or search in progress</p>
                        </div>
                      )}

                      {/* Social Media from Business Data */}
                      {analysis.business_info?.processed_data?.social_media && (
                        <div className="mt-4">
                          <h5 className="font-medium text-gray-700 mb-2">Other Social Media:</h5>
                          <div className="space-y-2">
                            {Object.entries(analysis.business_info.processed_data.social_media).map(([platform, url]) => (
                              url && (
                                <div key={platform} className="flex items-center">
                                  <span className="capitalize font-medium w-20">{platform}:</span>
                                  <a href={url} target="_blank" rel="noopener noreferrer" className="text-blue-500 hover:underline ml-2">
                                    {url}
                                  </a>
                                </div>
                              )
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                </InfoCard>

                {/* Technology Stack */}
                {analysis.tech_stack && !analysis.tech_stack.error && (
                  <InfoCard title="🛠️ Technology Stack Analysis" icon="⚙️" color="indigo">
                    <div className="mb-4">
                      <p className="text-sm text-gray-600">
                        <strong>Analysis Method:</strong> {
                          analysis.analysis_options?.tech_stack_method === 'both' ? '🔄 API + Custom Analysis' :
                          analysis.analysis_options?.tech_stack_method === 'api' ? '🌐 API-Based Detection' :
                          '🛠️ Custom Built Analysis'
                        }
                      </p>
                    </div>
                    
                    <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
                      {Object.entries(analysis.tech_stack).map(([category, technologies]) => {
                        if (Array.isArray(technologies) && technologies.length > 0) {
                          return (
                            <div key={category} className="bg-gray-50 rounded-lg p-4">
                              <h5 className="font-semibold text-gray-800 mb-3 capitalize flex items-center">
                                <span className="mr-2">
                                  {category === 'cms' && '🖥️'}
                                  {category === 'analytics' && '📊'}
                                  {category === 'advertising' && '📢'}
                                  {category === 'seo_tools' && '🔍'}
                                  {category === 'automation' && '🤖'}
                                  {category === 'hosting' && '🌐'}
                                  {category === 'security' && '🔒'}
                                </span>
                                {category.replace('_', ' ')}
                              </h5>
                              <div className="space-y-2">
                                {technologies.map((tech, idx) => (
                                  <div key={idx} className="flex items-center justify-between">
                                    <span className="text-sm capitalize">{tech.name || tech}</span>
                                    {tech.confidence && (
                                      <span className="text-xs bg-green-100 text-green-800 px-2 py-1 rounded-full">
                                        {Math.round(tech.confidence * 100)}%
                                      </span>
                                    )}
                                  </div>
                                ))}
                              </div>
                            </div>
                          );
                        }
                        return null;
                      })}
                    </div>

                    {analysis.tech_stack.confidence_score && (
                      <div className="mt-6">
                        <ScoreBar 
                          score={analysis.tech_stack.confidence_score * 100}
                          label="Technology Detection Confidence"
                          color="indigo"
                        />
                      </div>
                    )}
                  </InfoCard>
                )}

                {/* Website Analysis */}
                {analysis.website_analysis && !analysis.website_analysis.error && (
                  <InfoCard title="📊 Website Performance Analysis" icon="📈" color="purple">
                    <div className="mb-4">
                      <p className="text-sm text-gray-600">
                        <strong>Analysis Method:</strong> {
                          analysis.analysis_options?.website_analysis_method === 'both' ? '🔄 Google APIs + Custom Analysis' :
                          analysis.analysis_options?.website_analysis_method === 'google_apis' ? '📊 Google APIs Only' :
                          '🛠️ Custom Analysis Only'
                        }
                      </p>
                    </div>

                    <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6 mb-6">
                      {analysis.website_analysis.seo_score !== undefined && (
                        <ScoreBar 
                          score={analysis.website_analysis.seo_score}
                          label="🔍 SEO Score"
                          color="green"
                        />
                      )}
                      {analysis.website_analysis.design_quality_score !== undefined && (
                        <ScoreBar 
                          score={analysis.website_analysis.design_quality_score}
                          label="🎨 Design Quality"
                          color="blue"
                        />
                      )}
                      {analysis.website_analysis.conversion_tracking?.conversion_tracking_score !== undefined && (
                        <ScoreBar 
                          score={analysis.website_analysis.conversion_tracking.conversion_tracking_score}
                          label="📊 Conversion Tracking"
                          color="purple"
                        />
                      )}
                      {analysis.website_analysis.email_marketing?.email_automation_score !== undefined && (
                        <ScoreBar 
                          score={analysis.website_analysis.email_marketing.email_automation_score}
                          label="📧 Email Marketing"
                          color="orange"
                        />
                      )}
                    </div>

                    <div className="grid md:grid-cols-3 gap-6">
                      {/* SEO Details */}
                      {analysis.website_analysis.title_tag && (
                        <div className="bg-gray-50 rounded-lg p-4">
                          <h5 className="font-semibold text-gray-800 mb-3">🔍 SEO Elements</h5>
                          <div className="space-y-3 text-sm">
                            <div>
                              <span className="font-medium">Title Tag:</span>
                              <p className="text-gray-600 break-words mt-1">{analysis.website_analysis.title_tag.content}</p>
                              <span className={`text-xs px-2 py-1 rounded-full ${
                                analysis.website_analysis.title_tag.optimal ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                              }`}>
                                {analysis.website_analysis.title_tag.length} chars {analysis.website_analysis.title_tag.optimal ? '✓' : '⚠️'}
                              </span>
                            </div>
                            {analysis.website_analysis.meta_description && (
                              <div>
                                <span className="font-medium">Meta Description:</span>
                                <p className="text-gray-600 break-words mt-1">{analysis.website_analysis.meta_description.content}</p>
                                <span className={`text-xs px-2 py-1 rounded-full ${
                                  analysis.website_analysis.meta_description.optimal ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                                }`}>
                                  {analysis.website_analysis.meta_description.length} chars {analysis.website_analysis.meta_description.optimal ? '✓' : '⚠️'}
                                </span>
                              </div>
                            )}
                          </div>
                        </div>
                      )}

                      {/* Tracking Tools */}
                      {analysis.website_analysis.conversion_tracking && (
                        <div className="bg-gray-50 rounded-lg p-4">
                          <h5 className="font-semibold text-gray-800 mb-3">📊 Tracking & Analytics</h5>
                          <div className="space-y-2 text-sm">
                            {Object.entries(analysis.website_analysis.conversion_tracking).map(([tool, detected]) => {
                              if (typeof detected === 'boolean') {
                                return (
                                  <div key={tool} className="flex items-center justify-between">
                                    <span className="capitalize">{tool.replace('_', ' ')}</span>
                                    <span className={`text-xs px-2 py-1 rounded-full ${
                                      detected ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-600'
                                    }`}>
                                      {detected ? '✓ Active' : '✗ Not Found'}
                                    </span>
                                  </div>
                                );
                              }
                              return null;
                            })}
                          </div>
                        </div>
                      )}

                      {/* Marketing Tools */}
                      {analysis.website_analysis.email_marketing && (
                        <div className="bg-gray-50 rounded-lg p-4">
                          <h5 className="font-semibold text-gray-800 mb-3">📧 Email Marketing Tools</h5>
                          <div className="space-y-2 text-sm">
                            {analysis.website_analysis.email_marketing.tools_detected?.length > 0 ? (
                              analysis.website_analysis.email_marketing.tools_detected.map((tool, idx) => (
                                <div key={idx} className="flex items-center">
                                  <span className="w-2 h-2 bg-blue-500 rounded-full mr-2"></span>
                                  <span className="capitalize">{tool.replace('_', ' ')}</span>
                                </div>
                              ))
                            ) : (
                              <p className="text-gray-500">No email marketing tools detected</p>
                            )}
                          </div>
                        </div>
                      )}
                    </div>
                  </InfoCard>
                )}

                {/* Business Intelligence */}
                {analysis.business_intelligence && !analysis.business_intelligence.error && (
                  <InfoCard title="🎯 Business Intelligence & Investment Analysis" icon="📈" color="orange">
                    <div className="space-y-6">
                      
                      {/* Key Scores */}
                      <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-4">
                        {analysis.business_intelligence.business_intent_analysis?.digital_readiness_score && (
                          <ScoreBar 
                            score={analysis.business_intelligence.business_intent_analysis.digital_readiness_score * 100}
                            label="🚀 Digital Readiness"
                            color="blue"
                          />
                        )}
                        {analysis.business_intelligence.digital_marketing_signals?.website_conversion_potential && (
                          <ScoreBar 
                            score={analysis.business_intelligence.digital_marketing_signals.website_conversion_potential * 100}
                            label="💰 Conversion Potential"
                            color="green"
                          />
                        )}
                        {analysis.business_intelligence.investment_recommendation?.overall_score && (
                          <ScoreBar 
                            score={analysis.business_intelligence.investment_recommendation.overall_score * 100}
                            label="💎 Investment Score"
                            color="purple"
                          />
                        )}
                        {analysis.business_intelligence.sentiment_analysis?.online_reputation_score && (
                          <ScoreBar 
                            score={analysis.business_intelligence.sentiment_analysis.online_reputation_score * 100}
                            label="⭐ Reputation Score"
                            color="indigo"
                          />
                        )}
                      </div>

                      {/* Investment Recommendation */}
                      {analysis.business_intelligence.investment_recommendation && (
                        <div className="bg-gradient-to-r from-orange-50 to-red-50 rounded-lg p-6 border border-orange-200">
                          <h4 className="font-bold text-orange-800 mb-4 text-xl">💰 Investment Recommendation</h4>
                          <div className="grid md:grid-cols-2 gap-6">
                            <div>
                              <div className="space-y-3">
                                <p className="flex items-center">
                                  <strong className="mr-3">Investment Level:</strong> 
                                  <span className={`px-4 py-2 rounded-full text-sm font-bold ${
                                    analysis.business_intelligence.investment_recommendation.recommended_investment_level === 'high' 
                                      ? 'bg-green-200 text-green-800'
                                      : analysis.business_intelligence.investment_recommendation.recommended_investment_level === 'medium'
                                      ? 'bg-yellow-200 text-yellow-800'
                                      : 'bg-red-200 text-red-800'
                                  }`}>
                                    {analysis.business_intelligence.investment_recommendation.recommended_investment_level?.toUpperCase()}
                                  </span>
                                </p>
                                <p>
                                  <strong>Success Probability:</strong> 
                                  <span className="ml-2 text-lg font-bold text-green-600">
                                    {Math.round((analysis.business_intelligence.investment_recommendation.success_probability || 0) * 100)}%
                                  </span>
                                </p>
                                <p>
                                  <strong>Expected ROI Timeline:</strong> 
                                  <span className="ml-2 font-medium">{analysis.business_intelligence.investment_recommendation.expected_roi_timeline}</span>
                                </p>
                              </div>
                            </div>
                            <div>
                              {analysis.business_intelligence.investment_recommendation.budget_recommendation && (
                                <div className="bg-white rounded-lg p-4">
                                  <strong className="block mb-2">💵 Budget Recommendations:</strong>
                                  <ul className="space-y-2 text-sm">
                                    <li className="flex justify-between">
                                      <span>Monthly Minimum:</span>
                                      <strong>${analysis.business_intelligence.investment_recommendation.budget_recommendation.monthly_minimum?.toLocaleString()}</strong>
                                    </li>
                                    <li className="flex justify-between">
                                      <span>Monthly Optimal:</span>
                                      <strong className="text-green-600">${analysis.business_intelligence.investment_recommendation.budget_recommendation.monthly_optimal?.toLocaleString()}</strong>
                                    </li>
                                    <li className="flex justify-between">
                                      <span>Setup Costs:</span>
                                      <strong>${analysis.business_intelligence.investment_recommendation.budget_recommendation.setup_costs?.toLocaleString()}</strong>
                                    </li>
                                  </ul>
                                </div>
                              )}
                            </div>
                          </div>

                          {analysis.business_intelligence.investment_recommendation.priority_areas && (
                            <div className="mt-4">
                              <strong className="block mb-2">🎯 Priority Investment Areas:</strong>
                              <div className="flex flex-wrap gap-2">
                                {analysis.business_intelligence.investment_recommendation.priority_areas.map((area, idx) => (
                                  <span key={idx} className="bg-orange-200 text-orange-800 px-3 py-2 rounded-full text-sm font-medium">
                                    {area}
                                  </span>
                                ))}
                              </div>
                            </div>
                          )}
                        </div>
                      )}

                      {/* Growth Signals and Risk Factors */}
                      <div className="grid md:grid-cols-2 gap-6">
                        {analysis.business_intelligence.business_intent_analysis?.growth_signals && (
                          <div className="bg-green-50 rounded-lg p-4 border border-green-200">
                            <h5 className="font-semibold text-green-800 mb-3 text-lg">📈 Growth Signals</h5>
                            <ul className="space-y-2">
                              {analysis.business_intelligence.business_intent_analysis.growth_signals.map((signal, idx) => (
                                <li key={idx} className="flex items-start">
                                  <span className="text-green-500 mr-3 text-lg">✅</span>
                                  <span className="text-green-700">{signal}</span>
                                </li>
                              ))}
                            </ul>
                          </div>
                        )}

                        {analysis.business_intelligence.business_intent_analysis?.risk_factors && (
                          <div className="bg-red-50 rounded-lg p-4 border border-red-200">
                            <h5 className="font-semibold text-red-800 mb-3 text-lg">⚠️ Risk Factors</h5>
                            <ul className="space-y-2">
                              {analysis.business_intelligence.business_intent_analysis.risk_factors.map((risk, idx) => (
                                <li key={idx} className="flex items-start">
                                  <span className="text-red-500 mr-3 text-lg">⚠️</span>
                                  <span className="text-red-700">{risk}</span>
                                </li>
                              ))}
                            </ul>
                          </div>
                        )}
                      </div>
                    </div>
                  </InfoCard>
                )}

                {/* Outreach Message - Only show if requested */}
                {formData.generateOutreach && analysis.outreach_message && !analysis.outreach_message.error && (
                  <InfoCard title="✉️ Personalized Outreach Message" icon="📧" color="teal">
                    <div className="space-y-6">
                      
                      {/* Subject Line - Highlighted */}
                      <div className="bg-gradient-to-r from-teal-100 to-blue-100 rounded-lg p-6 border-2 border-teal-200">
                        <h4 className="font-bold text-teal-800 mb-3 text-lg">📧 Email Subject Line</h4>
                        <p className="text-teal-700 font-semibold text-lg bg-white rounded px-4 py-2 border">
                          {analysis.outreach_message.subject_line}
                        </p>
                      </div>

                      {/* One Line Intro - Highlighted */}
                      <div className="bg-gradient-to-r from-blue-100 to-purple-100 rounded-lg p-6 border-2 border-blue-200">
                        <h4 className="font-bold text-blue-800 mb-3 text-lg">👋 Opening Line</h4>
                        <p className="text-blue-700 font-medium text-lg bg-white rounded px-4 py-2 border italic">
                          "{analysis.outreach_message.opening_line}"
                        </p>
                      </div>

                      {/* Full Email Body */}
                      <div className="bg-white border-2 border-gray-200 rounded-lg p-6">
                        <h4 className="font-semibold text-gray-800 mb-4 text-lg">📝 Complete Email Content</h4>
                        
                        <div className="bg-gray-50 rounded-lg p-6 font-mono text-sm leading-relaxed">
                          <div className="border-b pb-3 mb-4">
                            <p><strong>Subject:</strong> {analysis.outreach_message.subject_line}</p>
                          </div>
                          
                          <div className="space-y-4">
                            <p className="font-semibold italic text-blue-600">"{analysis.outreach_message.opening_line}"</p>
                            
                            {analysis.outreach_message.body_paragraphs?.map((paragraph, idx) => (
                              <p key={idx} className="text-gray-700 leading-relaxed">
                                {paragraph}
                              </p>
                            ))}
                            
                            <p className="font-medium text-purple-600 mt-6">
                              {analysis.outreach_message.call_to_action}
                            </p>
                            
                            {analysis.outreach_message.ps_line && (
                              <p className="italic text-gray-600 border-t pt-4 mt-4">
                                <strong>P.S.</strong> {analysis.outreach_message.ps_line}
                              </p>
                            )}
                          </div>
                        </div>
                      </div>

                      {/* Personalization Details */}
                      {analysis.outreach_message.personalization_elements && (
                        <div className="bg-blue-50 rounded-lg p-4 border border-blue-200">
                          <h5 className="font-semibold text-blue-800 mb-3">🎯 Personalization Elements Used</h5>
                          <div className="flex flex-wrap gap-2">
                            {analysis.outreach_message.personalization_elements.map((element, idx) => (
                              <span key={idx} className="bg-blue-200 text-blue-800 px-3 py-1 rounded-full text-sm font-medium">
                                {element}
                              </span>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Email Tone & Key Insights */}
                      <div className="grid md:grid-cols-2 gap-4">
                        <div className="bg-green-50 rounded-lg p-4 border border-green-200">
                          <h5 className="font-semibold text-green-800 mb-2">🎭 Email Tone</h5>
                          <p className="text-green-700 capitalize font-medium">
                            {analysis.outreach_message.tone || 'Professional'}
                          </p>
                        </div>
                        
                        {analysis.outreach_message.key_insights_mentioned && (
                          <div className="bg-purple-50 rounded-lg p-4 border border-purple-200">
                            <h5 className="font-semibold text-purple-800 mb-2">💡 Key Insights Mentioned</h5>
                            <ul className="text-sm text-purple-700 space-y-1">
                              {analysis.outreach_message.key_insights_mentioned.map((insight, idx) => (
                                <li key={idx}>• {insight}</li>
                              ))}
                            </ul>
                          </div>
                        )}
                      </div>
                    </div>
                  </InfoCard>
                )}
              </div>
            )}
          </div>
        )}

        {/* History Tab */}
        {activeTab === 'history' && (
          <InfoCard title="Analysis History" icon="📚" color="gray">
            {analysisHistory.length > 0 ? (
              <div className="space-y-4">
                {analysisHistory.map((hist) => (
                  <div key={hist.analysis_id} className="bg-gray-50 rounded-lg p-4 hover:bg-gray-100 transition-colors cursor-pointer"
                       onClick={() => loadAnalysis(hist.analysis_id)}>
                    <div className="flex justify-between items-start">
                      <div>
                        <h4 className="font-semibold text-gray-800">
                          {hist.business_input?.business_name || 'Unknown Business'}
                        </h4>
                        <p className="text-sm text-gray-600">
                          {hist.business_input?.business_category}
                          {hist.business_input?.business_subcategory && ` > ${hist.business_input.business_subcategory}`}
                          {hist.business_input?.location && ` • ${hist.business_input.location}`}
                        </p>
                        <p className="text-xs text-gray-500 mt-1">
                          Analyzed: {new Date(hist.created_at).toLocaleDateString()} • 
                          Count: {hist.business_input?.business_count || 1}
                          {hist.business_input?.analysis_options?.generate_outreach && ' • Email Generated'}
                        </p>
                      </div>
                      <button className="text-blue-500 hover:text-blue-700 text-sm font-medium">
                        View Analysis →
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-12">
                <div className="text-6xl mb-4">📊</div>
                <h3 className="text-xl font-semibold text-gray-600 mb-2">No analyses yet</h3>
                <p className="text-gray-500">Start by analyzing your first business!</p>
              </div>
            )}
          </InfoCard>
        )}
      </div>
    </div>
  );
}

export default App;