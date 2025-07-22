from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from motor.motor_asyncio import AsyncIOMotorClient
import os
from dotenv import load_dotenv
from typing import Optional, List, Dict, Any
import asyncio
import uuid
import json
import re
from datetime import datetime
import aiohttp
import urllib.parse
from bs4 import BeautifulSoup
from emergentintegrations.llm.chat import LlmChat, UserMessage

# Load environment variables
load_dotenv()

app = FastAPI(title="AI Business Intelligence Tool")

# CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# MongoDB setup
MONGO_URL = os.getenv("MONGO_URL", "mongodb://localhost:27017")
DATABASE_NAME = os.getenv("DB_NAME", "business_intel_db")

client = AsyncIOMotorClient(MONGO_URL)
db = client[DATABASE_NAME]

# API Keys from environment
GEMINI_API_KEY = os.getenv("GEMINI_API_KEY")
GOOGLE_CUSTOM_SEARCH_API_KEY = os.getenv("GOOGLE_CUSTOM_SEARCH_API_KEY")
GOOGLE_SEARCH_ENGINE_ID = os.getenv("GOOGLE_SEARCH_ENGINE_ID")

# Pydantic models
class AnalysisOptions(BaseModel):
    tech_stack_method: str = "both"  # 'api', 'custom', 'both'
    website_analysis_method: str = "both"  # 'google_apis', 'custom', 'both'
    generate_outreach: bool = False

class BusinessInput(BaseModel):
    business_name: str
    business_count: int = 1
    business_category: Optional[str] = None
    business_subcategory: Optional[str] = None
    location: Optional[str] = None
    analysis_options: Optional[AnalysisOptions] = AnalysisOptions()

class BusinessAnalysis(BaseModel):
    analysis_id: str
    business_info: Dict[str, Any]
    website_analysis: Dict[str, Any]
    tech_stack: Dict[str, Any]
    seo_analysis: Dict[str, Any]
    competitor_analysis: List[Dict[str, Any]]
    digital_marketing_signals: Dict[str, Any]
    business_intent_score: float
    investment_recommendation: Dict[str, Any]
    outreach_message: Dict[str, Any]
    created_at: datetime

@app.on_event("startup")
async def startup_event():
    # Test database connection
    try:
        await client.admin.command('ping')
        print("Successfully connected to MongoDB")
    except Exception as e:
        print(f"Failed to connect to MongoDB: {e}")

async def extract_multiple_businesses(business_name: str, business_count: int, location: str = "", category: str = "") -> Dict[str, Any]:
    """Extract information for multiple businesses"""
    
    businesses = []
    search_queries = []
    
    # Generate different search queries for finding multiple businesses
    base_query = f"{business_name}"
    if category:
        base_query += f" {category}"
    if location:
        base_query += f" {location}"
        
    # Create variations for finding similar businesses
    search_queries = [
        f"{base_query}",
        f"{category} near {location}" if category and location else f"{business_name}",
        f"{business_name} competitors" if business_name else base_query,
        f"best {category} {location}" if category and location else base_query,
        f"{category} services {location}" if category and location else base_query
    ]
    
    # Limit to requested number of queries
    search_queries = search_queries[:min(business_count, 5)]
    
    for query in search_queries:
        try:
            business_info = await extract_google_business_profile(query, location)
            if business_info and business_info.get('processed_data'):
                businesses.append(business_info)
                if len(businesses) >= business_count:
                    break
        except Exception as e:
            print(f"Error extracting business for query '{query}': {e}")
            continue
    
    return {
        'total_found': len(businesses),
        'requested_count': business_count,
        'businesses': businesses,
        'search_queries_used': search_queries[:len(businesses)]
    }

async def extract_google_business_profile(business_name: str, location: str = "") -> Dict[str, Any]:
    """Extract business information using Google Custom Search API and web scraping"""
    search_query = f"{business_name} {location} contact email website phone"
    
    # Google Custom Search API approach
    api_results = {}
    if GOOGLE_CUSTOM_SEARCH_API_KEY and GOOGLE_SEARCH_ENGINE_ID:
        try:
            url = f"https://www.googleapis.com/customsearch/v1"
            params = {
                'key': GOOGLE_CUSTOM_SEARCH_API_KEY,
                'cx': GOOGLE_SEARCH_ENGINE_ID,
                'q': search_query,
                'num': 10
            }
            
            async with aiohttp.ClientSession() as session:
                async with session.get(url, params=params) as response:
                    if response.status == 200:
                        data = await response.json()
                        api_results = {
                            'source': 'google_api',
                            'results': data.get('items', [])
                        }
        except Exception as e:
            print(f"Google API search failed: {e}")
    
    # Custom web scraping approach
    scraped_results = {}
    try:
        search_url = f"https://www.google.com/search?q={urllib.parse.quote(search_query)}"
        headers = {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
        }
        
        async with aiohttp.ClientSession() as session:
            async with session.get(search_url, headers=headers) as response:
                if response.status == 200:
                    html = await response.text()
                    soup = BeautifulSoup(html, 'html.parser')
                    
                    # Extract basic business info from search results
                    scraped_results = {
                        'source': 'custom_scraping',
                        'business_name': business_name,
                        'search_snippets': []
                    }
                    
                    # Extract search result snippets
                    for result in soup.find_all('div', class_='g')[:5]:
                        snippet = result.find('span')
                        if snippet:
                            scraped_results['search_snippets'].append(snippet.get_text())
                    
    except Exception as e:
        print(f"Custom scraping failed: {e}")
    
    return {
        'api_results': api_results,
        'scraped_results': scraped_results,
        'processed_data': await process_business_data(api_results, scraped_results, business_name)
    }

async def process_business_data(api_results: Dict, scraped_results: Dict, business_name: str) -> Dict[str, Any]:
    """Process and extract structured business data using AI"""
    
    # Combine all available data
    all_data = {
        'api_data': api_results,
        'scraped_data': scraped_results,
        'business_name': business_name
    }
    
    # Use Gemini to extract structured information
    try:
        chat = LlmChat(
            api_key=GEMINI_API_KEY,
            session_id=f"business_extraction_{uuid.uuid4()}",
            system_message="You are an expert business data extraction analyst. Extract structured business information from search results and web data."
        ).with_model("gemini", "gemini-2.5-pro-preview-05-06")
        
        prompt = f"""
        Extract comprehensive business information from the following search results and data:
        
        Business Name: {business_name}
        Search Data: {json.dumps(all_data, default=str)}
        
        Please extract and return ONLY a JSON object with this exact structure:
        {{
            "business_name": "extracted business name or provided name",
            "email": "extracted email address or null",
            "phone": "extracted phone number or null", 
            "website": "extracted website URL or null",
            "address": "extracted physical address or null",
            "social_media": {{
                "linkedin": "linkedin url or null",
                "facebook": "facebook url or null", 
                "instagram": "instagram url or null",
                "twitter": "twitter url or null"
            }},
            "description": "business description or services offered",
            "services": ["list", "of", "services", "offered"],
            "business_hours": "operating hours if found",
            "years_in_business": "how long in business if mentioned",
            "confidence_score": 0.85
        }}
        
        IMPORTANT: 
        - If information is not found, use null values (not "Not found" or empty strings)
        - Extract contact information carefully from snippets and search results
        - Look for patterns like email addresses, phone numbers, website URLs
        - Include confidence score based on data quality (0.0 to 1.0)
        - Return ONLY the JSON object, no additional text
        """
        
        user_message = UserMessage(text=prompt)
        response = await chat.send_message(user_message)
        
        # Try to parse JSON from response
        try:
            # Clean the response and extract JSON
            clean_response = response.strip()
            if clean_response.startswith('```'):
                clean_response = re.sub(r'^```(?:json)?\s*', '', clean_response)
                clean_response = re.sub(r'\s*```$', '', clean_response)
            
            # Find JSON object in response
            json_match = re.search(r'\{.*\}', clean_response, re.DOTALL)
            if json_match:
                parsed_data = json.loads(json_match.group())
                
                # Ensure required fields exist
                required_fields = ['business_name', 'email', 'phone', 'website', 'address']
                for field in required_fields:
                    if field not in parsed_data:
                        parsed_data[field] = None
                
                return parsed_data
            else:
                return {
                    "business_name": business_name,
                    "email": None,
                    "phone": None,
                    "website": None,
                    "address": None,
                    "social_media": {},
                    "description": "Business data extraction in progress",
                    "services": [],
                    "confidence_score": 0.3,
                    "error": "Could not parse AI response"
                }
        except json.JSONDecodeError as e:
            return {
                "business_name": business_name,
                "email": None,
                "phone": None,
                "website": None,
                "address": None,
                "social_media": {},
                "description": "Business data extraction failed",
                "services": [],
                "confidence_score": 0.1,
                "error": f"JSON parsing error: {str(e)}"
            }
            
    except Exception as e:
        return {
            "business_name": business_name,
            "email": None,
            "phone": None,
            "website": None,
            "address": None,
            "social_media": {},
            "description": "AI processing failed",
            "services": [],
            "confidence_score": 0.0,
            "error": f"AI processing failed: {str(e)}"
        }

async def discover_linkedin_profile(business_name: str, website: str = "") -> Dict[str, Any]:
    """Discover LinkedIn profile using boolean search"""
    
    # Boolean search queries
    queries = [
        f'site:linkedin.com/company "{business_name}"',
        f'site:linkedin.com "{business_name}" company',
        f'{business_name} linkedin company profile'
    ]
    
    if website:
        domain = website.replace('https://', '').replace('http://', '').split('/')[0]
        queries.append(f'site:linkedin.com/company "{domain}"')
    
    results = []
    
    for query in queries:
        try:
            # Use Google Custom Search if available
            if GOOGLE_CUSTOM_SEARCH_API_KEY and GOOGLE_SEARCH_ENGINE_ID:
                url = f"https://www.googleapis.com/customsearch/v1"
                params = {
                    'key': GOOGLE_CUSTOM_SEARCH_API_KEY,
                    'cx': GOOGLE_SEARCH_ENGINE_ID,
                    'q': query,
                    'num': 5
                }
                
                async with aiohttp.ClientSession() as session:
                    async with session.get(url, params=params) as response:
                        if response.status == 200:
                            data = await response.json()
                            for item in data.get('items', []):
                                if 'linkedin.com/company' in item.get('link', ''):
                                    results.append({
                                        'url': item['link'],
                                        'title': item['title'],
                                        'snippet': item['snippet']
                                    })
                                    
        except Exception as e:
            print(f"LinkedIn search failed for query '{query}': {e}")
    
    return {
        'linkedin_profiles': results,
        'search_queries_used': queries,
        'total_found': len(results)
    }

async def analyze_technology_stack(website_url: str, method: str = "both") -> Dict[str, Any]:
    """Analyze website technology stack"""
    
    if not website_url:
        return {"error": "No website URL provided"}
    
    tech_analysis = {
        'cms': [],
        'analytics': [],
        'advertising': [],
        'seo_tools': [],
        'automation': [],
        'hosting': [],
        'security': [],
        'confidence_score': 0.0,
        'analysis_method': method
    }
    
    if method in ['custom', 'both']:
        # Custom technology detection
        try:
            headers = {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
            }
            
            async with aiohttp.ClientSession() as session:
                async with session.get(website_url, headers=headers, timeout=10) as response:
                    if response.status == 200:
                        html = await response.text()
                        headers_dict = dict(response.headers)
                        
                        # Analyze HTML content
                        soup = BeautifulSoup(html, 'html.parser')
                        
                        # Check for common technologies
                        tech_signatures = {
                            'wordpress': ['wp-content', 'wp-includes', 'wordpress'],
                            'shopify': ['shopify', 'cdn.shopify.com'],
                            'wix': ['wix.com', 'wixstatic.com'],
                            'squarespace': ['squarespace', 'sqsp.net'],
                            'google_analytics': ['google-analytics.com', 'gtag', 'ga('],
                            'facebook_pixel': ['facebook.com/tr', 'fbq('],
                            'google_ads': ['googleadservices.com', 'google-ads'],
                            'mailchimp': ['mailchimp.com', 'mc.us'],
                            'hubspot': ['hubspot.com', 'hs-analytics'],
                            'cloudflare': ['cloudflare.com', '__cfduid'],
                            'stripe': ['stripe.com', 'js.stripe.com'],
                            'paypal': ['paypal.com', 'paypalobjects.com'],
                            'hotjar': ['hotjar.com', 'static.hotjar.com'],
                            'intercom': ['intercom.io', 'widget.intercom.io']
                        }
                        
                        html_lower = html.lower()
                        
                        for tech, signatures in tech_signatures.items():
                            for signature in signatures:
                                if signature in html_lower:
                                    category = categorize_technology(tech)
                                    tech_analysis[category].append({
                                        'name': tech,
                                        'confidence': 0.8,
                                        'detection_method': 'html_analysis'
                                    })
                                    break
                        
                        # Check headers
                        server_header = headers_dict.get('server', '').lower()
                        if server_header:
                            if 'nginx' in server_header:
                                tech_analysis['hosting'].append({'name': 'nginx', 'confidence': 0.9, 'detection_method': 'headers'})
                            elif 'apache' in server_header:
                                tech_analysis['hosting'].append({'name': 'apache', 'confidence': 0.9, 'detection_method': 'headers'})
                        
                        tech_analysis['confidence_score'] = calculate_tech_confidence(tech_analysis)
                        
        except Exception as e:
            tech_analysis['error'] = f"Custom analysis failed: {str(e)}"
    
    # TODO: Add API-based detection when method is 'api' or 'both'
    if method in ['api', 'both']:
        # Placeholder for API-based tech detection
        # This could integrate with BuiltWith, Wappalyzer, or similar services
        pass
    
    return tech_analysis

def categorize_technology(tech: str) -> str:
    """Categorize technology into appropriate groups"""
    tech_categories = {
        'cms': ['wordpress', 'drupal', 'joomla', 'shopify', 'wix', 'squarespace'],
        'analytics': ['google_analytics', 'adobe_analytics', 'mixpanel', 'hotjar'],
        'advertising': ['google_ads', 'facebook_pixel', 'bing_ads'],
        'seo_tools': ['yoast', 'rankmath', 'semrush'],
        'automation': ['mailchimp', 'hubspot', 'marketo', 'intercom'],
        'hosting': ['nginx', 'apache', 'cloudflare'],
        'security': ['ssl', 'cloudflare']
    }
    
    for category, techs in tech_categories.items():
        if tech in techs:
            return category
    
    return 'other'

def calculate_tech_confidence(tech_analysis: Dict) -> float:
    """Calculate overall confidence score for technology detection"""
    total_detections = sum(len(techs) for techs in tech_analysis.values() if isinstance(techs, list))
    if total_detections == 0:
        return 0.0
    
    confidence_sum = 0
    for techs in tech_analysis.values():
        if isinstance(techs, list):
            for tech in techs:
                if isinstance(tech, dict) and 'confidence' in tech:
                    confidence_sum += tech['confidence']
    
    return min(confidence_sum / total_detections, 1.0)

async def analyze_website_performance(website_url: str, method: str = "both") -> Dict[str, Any]:
    """Analyze website performance and SEO"""
    
    analysis_results = {
        'seo_score': 0.0,
        'performance_score': 0.0,
        'design_quality_score': 0.0,
        'conversion_tracking': {},
        'email_marketing': {},
        'advertising_detected': {},
        'recommendations': [],
        'analysis_method': method
    }
    
    if not website_url:
        return {"error": "No website URL provided"}
    
    if method in ['custom', 'both']:
        # Custom website analysis
        try:
            headers = {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
            }
            
            async with aiohttp.ClientSession() as session:
                async with session.get(website_url, headers=headers, timeout=15) as response:
                    if response.status == 200:
                        html = await response.text()
                        soup = BeautifulSoup(html, 'html.parser')
                        
                        # SEO Analysis
                        seo_factors = analyze_seo_factors(soup, html)
                        analysis_results.update(seo_factors)
                        
                        # Design Quality Analysis
                        design_analysis = analyze_design_quality(soup, html)
                        analysis_results['design_quality_score'] = design_analysis.get('design_quality_score', 0)
                        
                        # Conversion Tracking Detection
                        conversion_tracking = detect_conversion_tracking(html)
                        analysis_results['conversion_tracking'] = conversion_tracking
                        
                        # Email Marketing Detection
                        email_marketing = detect_email_marketing(html)
                        analysis_results['email_marketing'] = email_marketing
                        
                        # Advertising Detection
                        advertising = detect_advertising(html)
                        analysis_results['advertising_detected'] = advertising
                        
        except Exception as e:
            analysis_results['error'] = f"Analysis failed: {str(e)}"
    
    # Google APIs analysis
    if method in ['google_apis', 'both']:
        try:
            # TODO: Implement Google PageSpeed Insights API integration
            # TODO: Implement Google Search Console API integration
            pass
        except Exception as e:
            analysis_results['google_api_error'] = str(e)
    
    return analysis_results

def analyze_seo_factors(soup: BeautifulSoup, html: str) -> Dict[str, Any]:
    """Analyze SEO factors"""
    
    seo_analysis = {
        'title_tag': None,
        'meta_description': None,
        'h1_tags': [],
        'h2_tags': [],
        'images_without_alt': 0,
        'internal_links': 0,
        'external_links': 0,
        'schema_markup': False
    }
    
    # Title tag
    title_tag = soup.find('title')
    if title_tag:
        title_content = title_tag.get_text().strip()
        seo_analysis['title_tag'] = {
            'content': title_content,
            'length': len(title_content),
            'optimal': 30 <= len(title_content) <= 60
        }
    
    # Meta description
    meta_desc = soup.find('meta', attrs={'name': 'description'})
    if meta_desc:
        desc_content = meta_desc.get('content', '')
        seo_analysis['meta_description'] = {
            'content': desc_content,
            'length': len(desc_content),
            'optimal': 120 <= len(desc_content) <= 160
        }
    
    # Header tags
    h1_tags = soup.find_all('h1')
    seo_analysis['h1_tags'] = [h1.get_text().strip() for h1 in h1_tags]
    
    h2_tags = soup.find_all('h2')
    seo_analysis['h2_tags'] = [h2.get_text().strip() for h2 in h2_tags[:5]]
    
    # Images without alt text
    images = soup.find_all('img')
    seo_analysis['images_without_alt'] = len([img for img in images if not img.get('alt')])
    
    # Links analysis
    links = soup.find_all('a', href=True)
    internal_links = 0
    external_links = 0
    
    for link in links:
        href = link['href']
        if href.startswith('http') and not any(domain in href for domain in ['localhost', '127.0.0.1']):
            external_links += 1
        elif href.startswith('/') or not href.startswith('http'):
            internal_links += 1
    
    seo_analysis['internal_links'] = internal_links
    seo_analysis['external_links'] = external_links
    
    # Schema markup detection
    seo_analysis['schema_markup'] = 'application/ld+json' in html.lower()
    
    # Calculate SEO score
    score = 0
    if seo_analysis['title_tag'] and seo_analysis['title_tag']['optimal']:
        score += 20
    if seo_analysis['meta_description'] and seo_analysis['meta_description']['optimal']:
        score += 20
    if len(seo_analysis['h1_tags']) == 1:
        score += 15
    if len(seo_analysis['h2_tags']) > 0:
        score += 10
    if seo_analysis['images_without_alt'] == 0:
        score += 15
    if seo_analysis['internal_links'] > 5:
        score += 10
    if seo_analysis['schema_markup']:
        score += 10
    
    seo_analysis['seo_score'] = min(score, 100)
    
    return seo_analysis

def analyze_design_quality(soup: BeautifulSoup, html: str) -> Dict[str, Any]:
    """Analyze website design quality"""
    
    design_factors = {
        'has_responsive_meta': bool(soup.find('meta', attrs={'name': 'viewport'})),
        'css_files_count': len(soup.find_all('link', rel='stylesheet')),
        'js_files_count': len(soup.find_all('script', src=True)),
        'inline_styles': len(soup.find_all(style=True)),
        'modern_css': 'grid' in html.lower() or 'flex' in html.lower(),
        'accessibility_features': {
            'alt_tags': len(soup.find_all('img', alt=True)),
            'aria_labels': len(soup.find_all(attrs={'aria-label': True})),
            'semantic_html': bool(soup.find('header') or soup.find('nav') or soup.find('main'))
        }
    }
    
    # Calculate design quality score
    score = 0
    if design_factors['has_responsive_meta']:
        score += 25
    if design_factors['css_files_count'] > 0:
        score += 15
    if design_factors['modern_css']:
        score += 20
    if design_factors['accessibility_features']['semantic_html']:
        score += 20
    if design_factors['accessibility_features']['alt_tags'] > 0:
        score += 10
    if design_factors['accessibility_features']['aria_labels'] > 0:
        score += 10
    
    return {
        'design_factors': design_factors,
        'design_quality_score': min(score, 100)
    }

def detect_conversion_tracking(html: str) -> Dict[str, Any]:
    """Detect conversion tracking implementations"""
    
    tracking = {
        'google_analytics': 'gtag(' in html or 'google-analytics.com' in html,
        'facebook_pixel': 'fbq(' in html or 'facebook.com/tr' in html,
        'google_ads_conversion': 'google-ads' in html or 'googleadservices.com' in html,
        'hotjar': 'hotjar.com' in html,
        'mixpanel': 'mixpanel.com' in html,
        'amplitude': 'amplitude.com' in html
    }
    
    tracking['total_tracking_tools'] = sum(tracking.values())
    tracking['conversion_tracking_score'] = min(tracking['total_tracking_tools'] * 20, 100)
    
    return tracking

def detect_email_marketing(html: str) -> Dict[str, Any]:
    """Detect email marketing automation tools"""
    
    email_tools = {
        'mailchimp': 'mailchimp.com' in html.lower(),
        'constant_contact': 'constantcontact.com' in html.lower(),
        'klaviyo': 'klaviyo.com' in html.lower(),
        'hubspot': 'hubspot.com' in html.lower(),
        'marketo': 'marketo.com' in html.lower(),
        'mailerlite': 'mailerlite.com' in html.lower(),
        'convertkit': 'convertkit.com' in html.lower()
    }
    
    detected_tools = [tool for tool, present in email_tools.items() if present]
    
    return {
        'tools_detected': detected_tools,
        'total_tools': len(detected_tools),
        'email_automation_score': min(len(detected_tools) * 30, 100)
    }

def detect_advertising(html: str) -> Dict[str, Any]:
    """Detect advertising platforms"""
    
    ad_platforms = {
        'google_ads': 'googleadservices.com' in html or 'googlesyndication.com' in html,
        'facebook_ads': 'facebook.com/tr' in html or 'connect.facebook.net' in html,
        'bing_ads': 'bing.com' in html or 'bat.bing.com' in html,
        'twitter_ads': 'ads-twitter.com' in html,
        'linkedin_ads': 'ads.linkedin.com' in html,
        'tiktok_ads': 'tiktok.com' in html and 'analytics' in html,
        'pinterest_ads': 'pintrk(' in html
    }
    
    active_platforms = [platform for platform, active in ad_platforms.items() if active]
    
    return {
        'active_platforms': active_platforms,
        'total_platforms': len(active_platforms),
        'advertising_presence_score': min(len(active_platforms) * 25, 100)
    }

async def analyze_business_intent_and_signals(business_data: Dict[str, Any], website_analysis: Dict[str, Any]) -> Dict[str, Any]:
    """Analyze business intent and digital marketing signals using AI"""
    
    try:
        chat = LlmChat(
            api_key=GEMINI_API_KEY,
            session_id=f"business_analysis_{uuid.uuid4()}",
            system_message="You are an expert digital marketing analyst specialized in business intelligence and investment readiness assessment."
        ).with_model("gemini", "gemini-2.5-pro-preview-05-06")
        
        analysis_prompt = f"""
        Analyze the following business data and website analysis to provide comprehensive business intelligence:
        
        BUSINESS DATA:
        {json.dumps(business_data, default=str)}
        
        WEBSITE ANALYSIS:
        {json.dumps(website_analysis, default=str)}
        
        Please provide a comprehensive analysis in JSON format with the following structure:
        {{
            "business_intent_analysis": {{
                "digital_readiness_score": 0.85,
                "growth_signals": ["list of positive growth indicators"],
                "risk_factors": ["list of potential risks"],
                "market_positioning": "description of market position",
                "competitive_advantage": "identified competitive advantages"
            }},
            "digital_marketing_signals": {{
                "current_marketing_maturity": "basic/intermediate/advanced",
                "website_conversion_potential": 0.75,
                "seo_optimization_level": "poor/fair/good/excellent",
                "social_media_presence": "weak/moderate/strong",
                "content_marketing_readiness": 0.60,
                "paid_advertising_readiness": 0.80
            }},
            "investment_recommendation": {{
                "overall_score": 0.78,
                "recommended_investment_level": "low/medium/high",
                "priority_areas": ["SEO", "Conversion Optimization", "Content Marketing"],
                "expected_roi_timeline": "3-6 months",
                "budget_recommendation": {{
                    "monthly_minimum": 2000,
                    "monthly_optimal": 5000,
                    "setup_costs": 3000
                }},
                "success_probability": 0.82
            }},
            "sentiment_analysis": {{
                "brand_perception": "positive/neutral/negative",
                "customer_engagement_signals": 0.65,
                "online_reputation_score": 0.70,
                "trust_indicators": ["list of trust signals found"],
                "credibility_factors": ["professional website", "social proof", "testimonials"]
            }},
            "actionable_recommendations": [
                {{
                    "category": "SEO",
                    "priority": "high",
                    "action": "specific action to take",
                    "expected_impact": "description of expected outcome",
                    "timeline": "2-4 weeks"
                }}
            ]
        }}
        
        Base your analysis on:
        1. Website quality and functionality
        2. Current digital marketing setup
        3. Technology infrastructure
        4. Business information completeness
        5. Market indicators and competitive positioning
        6. Conversion tracking and analytics setup
        7. Content quality and marketing automation readiness
        
        Provide realistic scores and actionable insights. Return ONLY the JSON object.
        """
        
        user_message = UserMessage(text=analysis_prompt)
        response = await chat.send_message(user_message)
        
        # Parse JSON response
        try:
            # Clean the response
            clean_response = response.strip()
            if clean_response.startswith('```'):
                clean_response = re.sub(r'^```(?:json)?\s*', '', clean_response)
                clean_response = re.sub(r'\s*```$', '', clean_response)
            
            json_match = re.search(r'\{.*\}', clean_response, re.DOTALL)
            if json_match:
                return json.loads(json_match.group())
            else:
                return {"error": "Could not parse AI analysis response", "raw_response": response}
        except json.JSONDecodeError as e:
            return {"error": f"Invalid JSON in AI response: {str(e)}", "raw_response": response}
            
    except Exception as e:
        return {"error": f"Business analysis failed: {str(e)}"}

async def generate_personalized_outreach(business_analysis: Dict[str, Any], business_name: str) -> Dict[str, Any]:
    """Generate personalized outreach message using AI"""
    
    try:
        chat = LlmChat(
            api_key=GEMINI_API_KEY,
            session_id=f"outreach_generation_{uuid.uuid4()}",
            system_message="You are an expert copywriter specializing in personalized B2B outreach for digital marketing services."
        ).with_model("gemini", "gemini-2.5-pro-preview-05-06")
        
        outreach_prompt = f"""
        Create a personalized outreach email based on the comprehensive business analysis:
        
        BUSINESS NAME: {business_name}
        BUSINESS ANALYSIS: {json.dumps(business_analysis, default=str)}
        
        Generate a professional outreach email in JSON format:
        {{
            "subject_line": "Personalized subject line based on analysis findings",
            "opening_line": "Personalized greeting and hook based on specific findings",
            "body_paragraphs": [
                "First paragraph - personal connection and credibility",
                "Second paragraph - specific insights about their business",
                "Third paragraph - value proposition and solution",
                "Fourth paragraph - clear call to action"
            ],
            "call_to_action": "Specific next step request",
            "ps_line": "Additional value or urgency",
            "personalization_elements": [
                "List of specific personalization factors used"
            ],
            "tone": "professional/friendly/consultative",
            "key_insights_mentioned": [
                "Specific insights from analysis that were highlighted"
            ]
        }}
        
        Guidelines:
        1. Make it highly personalized based on their specific analysis results
        2. Mention 2-3 specific findings from the website/business analysis
        3. Focus on value and results, not features
        4. Keep it concise but comprehensive
        5. Include social proof or credibility indicators
        6. Create urgency without being pushy
        7. Make the subject line compelling and curiosity-driven
        8. Ensure the tone matches the business type and sophistication level
        
        Return ONLY the JSON object.
        """
        
        user_message = UserMessage(text=outreach_prompt)
        response = await chat.send_message(user_message)
        
        # Parse JSON response
        try:
            # Clean the response
            clean_response = response.strip()
            if clean_response.startswith('```'):
                clean_response = re.sub(r'^```(?:json)?\s*', '', clean_response)
                clean_response = re.sub(r'\s*```$', '', clean_response)
            
            json_match = re.search(r'\{.*\}', clean_response, re.DOTALL)
            if json_match:
                return json.loads(json_match.group())
            else:
                return {"error": "Could not parse outreach generation response", "raw_response": response}
        except json.JSONDecodeError as e:
            return {"error": f"Invalid JSON in outreach response: {str(e)}", "raw_response": response}
            
    except Exception as e:
        return {"error": f"Outreach generation failed: {str(e)}"}

@app.post("/api/analyze-business")
async def analyze_business(business_input: BusinessInput):
    """Main endpoint to analyze a business"""
    
    try:
        # Generate unique analysis ID
        analysis_id = str(uuid.uuid4())
        
        # Get analysis options
        options = business_input.analysis_options or AnalysisOptions()
        
        print(f"Starting analysis for: {business_input.business_name}")
        print(f"Business count: {business_input.business_count}")
        print(f"Analysis options: {options}")
        
        # Step 1: Extract business information
        print(f"Extracting business data...")
        if business_input.business_count > 1:
            business_data = await extract_multiple_businesses(
                business_input.business_name,
                business_input.business_count,
                business_input.location or "",
                business_input.business_category or ""
            )
        else:
            single_business = await extract_google_business_profile(
                business_input.business_name, 
                business_input.location or ""
            )
            business_data = {
                'total_found': 1,
                'requested_count': 1,
                'businesses': [single_business] if single_business else [],
                'main_business': single_business
            }
        
        # Get primary business for analysis
        primary_business = None
        if business_data.get('businesses') and len(business_data['businesses']) > 0:
            primary_business = business_data['businesses'][0]
        elif business_data.get('main_business'):
            primary_business = business_data['main_business']
        
        # Step 2: Discover LinkedIn profile
        print("Discovering LinkedIn profile...")
        linkedin_data = {}
        if primary_business and primary_business.get('processed_data'):
            linkedin_data = await discover_linkedin_profile(
                business_input.business_name,
                primary_business['processed_data'].get('website', '')
            )
        
        # Step 3: Analyze technology stack
        print("Analyzing technology stack...")
        tech_analysis = {}
        if primary_business and primary_business.get('processed_data', {}).get('website'):
            tech_analysis = await analyze_technology_stack(
                primary_business['processed_data']['website'], 
                options.tech_stack_method
            )
        
        # Step 4: Website performance analysis
        print("Analyzing website performance...")
        website_analysis = {}
        if primary_business and primary_business.get('processed_data', {}).get('website'):
            website_analysis = await analyze_website_performance(
                primary_business['processed_data']['website'], 
                options.website_analysis_method
            )
        
        # Step 5: Business intent and signals analysis
        print("Analyzing business intent and signals...")
        primary_business_data = primary_business.get('processed_data', {}) if primary_business else {}
        intent_analysis = await analyze_business_intent_and_signals(
            primary_business_data,
            website_analysis
        )
        
        # Step 6: Generate personalized outreach (only if requested)
        print(f"Generate outreach: {options.generate_outreach}")
        outreach_message = {}
        if options.generate_outreach:
            print("Generating personalized outreach...")
            outreach_message = await generate_personalized_outreach(
                intent_analysis,
                business_input.business_name
            )
        
        # Compile comprehensive analysis
        comprehensive_analysis = {
            'analysis_id': analysis_id,
            'business_input': business_input.dict(),
            'business_info': primary_business if primary_business else {},
            'all_businesses': business_data,
            'linkedin_profile': linkedin_data,
            'tech_stack': tech_analysis,
            'website_analysis': website_analysis,
            'business_intelligence': intent_analysis,
            'outreach_message': outreach_message if options.generate_outreach else {'note': 'Outreach generation was not requested'},
            'analysis_options': options.dict(),
            'created_at': datetime.utcnow(),
            'processing_time': 'completed'
        }
        
        # Save to database
        result = await db.business_analyses.insert_one(comprehensive_analysis)
        comprehensive_analysis['_id'] = str(result.inserted_id)
        
        print(f"Analysis completed successfully. ID: {analysis_id}")
        
        return {
            'success': True,
            'analysis_id': analysis_id,
            'data': comprehensive_analysis
        }
        
    except Exception as e:
        print(f"Analysis failed: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Analysis failed: {str(e)}")

@app.get("/api/analysis/{analysis_id}")
async def get_analysis(analysis_id: str):
    """Get analysis by ID"""
    
    try:
        analysis = await db.business_analyses.find_one({'analysis_id': analysis_id})
        
        if not analysis:
            raise HTTPException(status_code=404, detail="Analysis not found")
        
        # Convert ObjectId to string for JSON serialization
        analysis['_id'] = str(analysis['_id'])
        
        return {
            'success': True,
            'data': analysis
        }
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to retrieve analysis: {str(e)}")

@app.get("/api/analyses")
async def get_all_analyses():
    """Get all analyses"""
    
    try:
        analyses = []
        async for analysis in db.business_analyses.find().sort('created_at', -1):
            analysis['_id'] = str(analysis['_id'])
            analyses.append(analysis)
        
        return {
            'success': True,
            'data': analyses,
            'total': len(analyses)
        }
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to retrieve analyses: {str(e)}")

@app.get("/api/health")
async def health_check():
    """Health check endpoint"""
    return {
        'status': 'healthy',
        'database_connected': True,
        'gemini_configured': bool(GEMINI_API_KEY),
        'google_search_configured': bool(GOOGLE_CUSTOM_SEARCH_API_KEY),
        'timestamp': datetime.utcnow()
    }

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8001)