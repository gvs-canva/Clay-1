import React, { useState, useEffect } from 'react';
import axios from 'axios';
import './App.css';

const API_BASE_URL = process.env.REACT_APP_BACKEND_URL || 'http://localhost:8001';

function App() {
  const [businessName, setBusinessName] = useState('');
  const [businessCategory, setBusinessCategory] = useState('');
  const [location, setLocation] = useState('');
  const [loading, setLoading] = useState(false);
  const [analysis, setAnalysis] = useState(null);
  const [error, setError] = useState('');
  const [analysisHistory, setAnalysisHistory] = useState([]);
  const [activeTab, setActiveTab] = useState('analyzer');

  useEffect(() => {
    fetchAnalysisHistory();
  }, []);

  const fetchAnalysisHistory = async () => {
    try {
      const response = await axios.get(`${API_BASE_URL}/api/analyses`);
      if (response.data.success) {
        setAnalysisHistory(response.data.data);
      }
    } catch (error) {
      console.error('Failed to fetch analysis history:', error);
    }
  };

  const handleAnalyze = async (e) => {
    e.preventDefault();
    
    if (!businessName.trim()) {
      setError('Please enter a business name');
      return;
    }

    setLoading(true);
    setError('');
    setAnalysis(null);

    try {
      const response = await axios.post(`${API_BASE_URL}/api/analyze-business`, {
        business_name: businessName.trim(),
        business_category: businessCategory.trim() || null,
        location: location.trim() || null
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

  const ScoreBar = ({ score, label, color = "blue" }) => (
    <div className="mb-4">
      <div className="flex justify-between items-center mb-1">
        <span className="text-sm font-medium text-gray-700">{label}</span>
        <span className="text-sm font-semibold text-gray-900">{Math.round(score)}/100</span>
      </div>
      <div className="w-full bg-gray-200 rounded-full h-2">
        <div 
          className={`h-2 rounded-full bg-${color}-500 transition-all duration-500`}
          style={{ width: `${Math.min(score, 100)}%` }}
        ></div>
      </div>
    </div>
  );

  const InfoCard = ({ title, children, icon, color = "blue" }) => (
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
  );

  const TabButton = ({ tab, label, active, onClick }) => (
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
  );

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
            <InfoCard title="Business Analysis Input" icon="🎯" color="blue">
              <form onSubmit={handleAnalyze} className="space-y-6">
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    Business Name *
                  </label>
                  <input
                    type="text"
                    value={businessName}
                    onChange={(e) => setBusinessName(e.target.value)}
                    placeholder="Enter business name (e.g., 'Wedding Makeover Studio')"
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    required
                  />
                </div>

                <div className="grid md:grid-cols-2 gap-6">
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">
                      Business Category
                    </label>
                    <input
                      type="text"
                      value={businessCategory}
                      onChange={(e) => setBusinessCategory(e.target.value)}
                      placeholder="e.g., 'Makeup Artist', 'Restaurant'"
                      className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">
                      Location
                    </label>
                    <input
                      type="text"
                      value={location}
                      onChange={(e) => setLocation(e.target.value)}
                      placeholder="e.g., 'New York, NY'"
                      className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full bg-gradient-to-r from-blue-500 to-purple-600 text-white font-bold py-4 px-6 rounded-lg hover:from-blue-600 hover:to-purple-700 transition-all duration-300 transform hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none"
                >
                  {loading ? (
                    <div className="flex items-center justify-center">
                      <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-white mr-3"></div>
                      Analyzing Business... (This may take 30-60 seconds)
                    </div>
                  ) : (
                    '🔍 Analyze Business'
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
                <InfoCard title="Business Profile" icon="🏢" color="green">
                  <div className="grid md:grid-cols-2 gap-6">
                    <div>
                      <h4 className="font-semibold text-gray-800 mb-3">Contact Information</h4>
                      {analysis.business_info?.processed_data ? (
                        <div className="space-y-2">
                          <p><strong>Name:</strong> {analysis.business_info.processed_data.business_name || 'N/A'}</p>
                          <p><strong>Email:</strong> {analysis.business_info.processed_data.email || 'N/A'}</p>
                          <p><strong>Phone:</strong> {analysis.business_info.processed_data.phone || 'N/A'}</p>
                          <p><strong>Website:</strong> 
                            {analysis.business_info.processed_data.website ? (
                              <a href={analysis.business_info.processed_data.website} target="_blank" rel="noopener noreferrer" className="text-blue-500 hover:underline ml-1">
                                {analysis.business_info.processed_data.website}
                              </a>
                            ) : ' N/A'}
                          </p>
                          <p><strong>Address:</strong> {analysis.business_info.processed_data.address || 'N/A'}</p>
                        </div>
                      ) : (
                        <p className="text-gray-500">Business information extraction in progress...</p>
                      )}
                    </div>

                    <div>
                      <h4 className="font-semibold text-gray-800 mb-3">LinkedIn Profile</h4>
                      {analysis.linkedin_profile?.linkedin_profiles?.length > 0 ? (
                        <div className="space-y-2">
                          {analysis.linkedin_profile.linkedin_profiles.map((profile, idx) => (
                            <div key={idx} className="border-l-4 border-blue-500 pl-3">
                              <a href={profile.url} target="_blank" rel="noopener noreferrer" className="text-blue-500 hover:underline font-medium">
                                {profile.title}
                              </a>
                              <p className="text-sm text-gray-600">{profile.snippet}</p>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <p className="text-gray-500">LinkedIn profile not found</p>
                      )}
                    </div>
                  </div>
                </InfoCard>

                {/* Technology Stack */}
                {analysis.tech_stack && !analysis.tech_stack.error && (
                  <InfoCard title="Technology Stack Analysis" icon="⚙️" color="indigo">
                    <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
                      {Object.entries(analysis.tech_stack).map(([category, technologies]) => {
                        if (Array.isArray(technologies) && technologies.length > 0) {
                          return (
                            <div key={category} className="bg-gray-50 rounded-lg p-4">
                              <h5 className="font-semibold text-gray-800 mb-3 capitalize">
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
                  <InfoCard title="Website Performance Analysis" icon="📊" color="purple">
                    <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6 mb-6">
                      {analysis.website_analysis.seo_score !== undefined && (
                        <ScoreBar 
                          score={analysis.website_analysis.seo_score}
                          label="SEO Score"
                          color="green"
                        />
                      )}
                      {analysis.website_analysis.design_quality_score !== undefined && (
                        <ScoreBar 
                          score={analysis.website_analysis.design_quality_score}
                          label="Design Quality"
                          color="blue"
                        />
                      )}
                      {analysis.website_analysis.conversion_tracking?.conversion_tracking_score !== undefined && (
                        <ScoreBar 
                          score={analysis.website_analysis.conversion_tracking.conversion_tracking_score}
                          label="Conversion Tracking"
                          color="purple"
                        />
                      )}
                    </div>

                    <div className="grid md:grid-cols-3 gap-6">
                      {/* SEO Details */}
                      {analysis.website_analysis.title_tag && (
                        <div className="bg-gray-50 rounded-lg p-4">
                          <h5 className="font-semibold text-gray-800 mb-3">SEO Elements</h5>
                          <div className="space-y-2 text-sm">
                            <div>
                              <span className="font-medium">Title:</span>
                              <p className="text-gray-600 break-words">{analysis.website_analysis.title_tag.content}</p>
                              <span className={`text-xs px-2 py-1 rounded-full ${
                                analysis.website_analysis.title_tag.optimal ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                              }`}>
                                {analysis.website_analysis.title_tag.length} chars
                              </span>
                            </div>
                            {analysis.website_analysis.meta_description && (
                              <div>
                                <span className="font-medium">Meta Description:</span>
                                <p className="text-gray-600 break-words">{analysis.website_analysis.meta_description.content}</p>
                                <span className={`text-xs px-2 py-1 rounded-full ${
                                  analysis.website_analysis.meta_description.optimal ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                                }`}>
                                  {analysis.website_analysis.meta_description.length} chars
                                </span>
                              </div>
                            )}
                          </div>
                        </div>
                      )}

                      {/* Conversion Tracking */}
                      {analysis.website_analysis.conversion_tracking && (
                        <div className="bg-gray-50 rounded-lg p-4">
                          <h5 className="font-semibold text-gray-800 mb-3">Tracking Tools</h5>
                          <div className="space-y-2 text-sm">
                            {Object.entries(analysis.website_analysis.conversion_tracking).map(([tool, detected]) => {
                              if (typeof detected === 'boolean' && detected) {
                                return (
                                  <div key={tool} className="flex items-center">
                                    <span className="w-2 h-2 bg-green-500 rounded-full mr-2"></span>
                                    <span className="capitalize">{tool.replace('_', ' ')}</span>
                                  </div>
                                );
                              }
                              return null;
                            })}
                          </div>
                        </div>
                      )}

                      {/* Email Marketing */}
                      {analysis.website_analysis.email_marketing && (
                        <div className="bg-gray-50 rounded-lg p-4">
                          <h5 className="font-semibold text-gray-800 mb-3">Email Marketing</h5>
                          <div className="space-y-2 text-sm">
                            {analysis.website_analysis.email_marketing.tools_detected?.map((tool, idx) => (
                              <div key={idx} className="flex items-center">
                                <span className="w-2 h-2 bg-blue-500 rounded-full mr-2"></span>
                                <span className="capitalize">{tool.replace('_', ' ')}</span>
                              </div>
                            ))}
                            {analysis.website_analysis.email_marketing.tools_detected?.length === 0 && (
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
                  <InfoCard title="Business Intelligence & Investment Analysis" icon="🎯" color="orange">
                    <div className="space-y-6">
                      {/* Key Scores */}
                      <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-4">
                        {analysis.business_intelligence.business_intent_analysis?.digital_readiness_score && (
                          <ScoreBar 
                            score={analysis.business_intelligence.business_intent_analysis.digital_readiness_score * 100}
                            label="Digital Readiness"
                            color="blue"
                          />
                        )}
                        {analysis.business_intelligence.digital_marketing_signals?.website_conversion_potential && (
                          <ScoreBar 
                            score={analysis.business_intelligence.digital_marketing_signals.website_conversion_potential * 100}
                            label="Conversion Potential"
                            color="green"
                          />
                        )}
                        {analysis.business_intelligence.investment_recommendation?.overall_score && (
                          <ScoreBar 
                            score={analysis.business_intelligence.investment_recommendation.overall_score * 100}
                            label="Investment Score"
                            color="purple"
                          />
                        )}
                        {analysis.business_intelligence.sentiment_analysis?.online_reputation_score && (
                          <ScoreBar 
                            score={analysis.business_intelligence.sentiment_analysis.online_reputation_score * 100}
                            label="Reputation Score"
                            color="indigo"
                          />
                        )}
                      </div>

                      {/* Investment Recommendation */}
                      {analysis.business_intelligence.investment_recommendation && (
                        <div className="bg-gradient-to-r from-orange-50 to-red-50 rounded-lg p-6 border border-orange-200">
                          <h4 className="font-bold text-orange-800 mb-4">💰 Investment Recommendation</h4>
                          <div className="grid md:grid-cols-2 gap-6">
                            <div>
                              <p className="mb-2">
                                <strong>Recommended Level:</strong> 
                                <span className={`ml-2 px-3 py-1 rounded-full text-sm font-medium ${
                                  analysis.business_intelligence.investment_recommendation.recommended_investment_level === 'high' 
                                    ? 'bg-green-100 text-green-800'
                                    : analysis.business_intelligence.investment_recommendation.recommended_investment_level === 'medium'
                                    ? 'bg-yellow-100 text-yellow-800'
                                    : 'bg-red-100 text-red-800'
                                }`}>
                                  {analysis.business_intelligence.investment_recommendation.recommended_investment_level}
                                </span>
                              </p>
                              <p className="mb-2">
                                <strong>Success Probability:</strong> {Math.round((analysis.business_intelligence.investment_recommendation.success_probability || 0) * 100)}%
                              </p>
                              <p>
                                <strong>Expected ROI Timeline:</strong> {analysis.business_intelligence.investment_recommendation.expected_roi_timeline}
                              </p>
                            </div>
                            <div>
                              {analysis.business_intelligence.investment_recommendation.budget_recommendation && (
                                <div>
                                  <strong>Budget Recommendations:</strong>
                                  <ul className="list-disc list-inside mt-2 text-sm space-y-1">
                                    <li>Monthly Minimum: ${analysis.business_intelligence.investment_recommendation.budget_recommendation.monthly_minimum?.toLocaleString()}</li>
                                    <li>Monthly Optimal: ${analysis.business_intelligence.investment_recommendation.budget_recommendation.monthly_optimal?.toLocaleString()}</li>
                                    <li>Setup Costs: ${analysis.business_intelligence.investment_recommendation.budget_recommendation.setup_costs?.toLocaleString()}</li>
                                  </ul>
                                </div>
                              )}
                            </div>
                          </div>

                          {analysis.business_intelligence.investment_recommendation.priority_areas && (
                            <div className="mt-4">
                              <strong>Priority Areas:</strong>
                              <div className="flex flex-wrap gap-2 mt-2">
                                {analysis.business_intelligence.investment_recommendation.priority_areas.map((area, idx) => (
                                  <span key={idx} className="bg-orange-100 text-orange-800 px-3 py-1 rounded-full text-sm font-medium">
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
                            <h5 className="font-semibold text-green-800 mb-3">📈 Growth Signals</h5>
                            <ul className="space-y-2">
                              {analysis.business_intelligence.business_intent_analysis.growth_signals.map((signal, idx) => (
                                <li key={idx} className="flex items-start">
                                  <span className="text-green-500 mr-2">✓</span>
                                  <span className="text-green-700 text-sm">{signal}</span>
                                </li>
                              ))}
                            </ul>
                          </div>
                        )}

                        {analysis.business_intelligence.business_intent_analysis?.risk_factors && (
                          <div className="bg-red-50 rounded-lg p-4 border border-red-200">
                            <h5 className="font-semibold text-red-800 mb-3">⚠️ Risk Factors</h5>
                            <ul className="space-y-2">
                              {analysis.business_intelligence.business_intent_analysis.risk_factors.map((risk, idx) => (
                                <li key={idx} className="flex items-start">
                                  <span className="text-red-500 mr-2">⚠</span>
                                  <span className="text-red-700 text-sm">{risk}</span>
                                </li>
                              ))}
                            </ul>
                          </div>
                        )}
                      </div>
                    </div>
                  </InfoCard>
                )}

                {/* Outreach Message */}
                {analysis.outreach_message && !analysis.outreach_message.error && (
                  <InfoCard title="Personalized Outreach Message" icon="✉️" color="teal">
                    <div className="space-y-6">
                      {/* Subject Line */}
                      <div className="bg-teal-50 rounded-lg p-4 border border-teal-200">
                        <h4 className="font-semibold text-teal-800 mb-2">📧 Subject Line</h4>
                        <p className="text-teal-700 font-medium">{analysis.outreach_message.subject_line}</p>
                      </div>

                      {/* Email Body */}
                      <div className="bg-white border rounded-lg p-6">
                        <h4 className="font-semibold text-gray-800 mb-4">Email Content</h4>
                        
                        {/* Opening Line */}
                        <div className="mb-4">
                          <h5 className="font-medium text-gray-700 mb-2">Opening Line:</h5>
                          <p className="text-gray-600 italic">{analysis.outreach_message.opening_line}</p>
                        </div>

                        {/* Body Paragraphs */}
                        <div className="mb-4">
                          <h5 className="font-medium text-gray-700 mb-2">Email Body:</h5>
                          <div className="space-y-3">
                            {analysis.outreach_message.body_paragraphs?.map((paragraph, idx) => (
                              <p key={idx} className="text-gray-600 leading-relaxed">
                                {paragraph}
                              </p>
                            ))}
                          </div>
                        </div>

                        {/* Call to Action */}
                        <div className="mb-4">
                          <h5 className="font-medium text-gray-700 mb-2">Call to Action:</h5>
                          <p className="text-gray-600 font-medium">{analysis.outreach_message.call_to_action}</p>
                        </div>

                        {/* PS Line */}
                        {analysis.outreach_message.ps_line && (
                          <div className="border-t pt-4">
                            <h5 className="font-medium text-gray-700 mb-2">P.S.:</h5>
                            <p className="text-gray-600 italic">{analysis.outreach_message.ps_line}</p>
                          </div>
                        )}
                      </div>

                      {/* Personalization Elements */}
                      {analysis.outreach_message.personalization_elements && (
                        <div className="bg-blue-50 rounded-lg p-4 border border-blue-200">
                          <h5 className="font-semibold text-blue-800 mb-3">🎯 Personalization Elements Used</h5>
                          <div className="flex flex-wrap gap-2">
                            {analysis.outreach_message.personalization_elements.map((element, idx) => (
                              <span key={idx} className="bg-blue-100 text-blue-800 px-3 py-1 rounded-full text-sm">
                                {element}
                              </span>
                            ))}
                          </div>
                        </div>
                      )}
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
                          {hist.business_input?.business_category} • {hist.business_input?.location}
                        </p>
                        <p className="text-xs text-gray-500 mt-1">
                          Analyzed: {new Date(hist.created_at).toLocaleDateString()}
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