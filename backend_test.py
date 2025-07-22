#!/usr/bin/env python3
"""
Comprehensive Backend Testing for AI Business Intelligence Tool
Tests all API endpoints and core functionality
"""

import asyncio
import aiohttp
import json
import time
from datetime import datetime
from typing import Dict, Any, List
import os
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

# Get backend URL from frontend .env
BACKEND_URL = "http://localhost:8001"
try:
    with open('/app/frontend/.env', 'r') as f:
        for line in f:
            if line.startswith('REACT_APP_BACKEND_URL='):
                BACKEND_URL = line.split('=', 1)[1].strip()
                break
except:
    pass

API_BASE_URL = f"{BACKEND_URL}/api"

class BackendTester:
    def __init__(self):
        self.session = None
        self.test_results = []
        self.analysis_id = None
        
    async def __aenter__(self):
        self.session = aiohttp.ClientSession()
        return self
        
    async def __aexit__(self, exc_type, exc_val, exc_tb):
        if self.session:
            await self.session.close()
    
    def log_test(self, test_name: str, success: bool, details: str, response_data: Any = None):
        """Log test results"""
        result = {
            'test_name': test_name,
            'success': success,
            'details': details,
            'timestamp': datetime.utcnow().isoformat(),
            'response_data': response_data
        }
        self.test_results.append(result)
        status = "✅ PASS" if success else "❌ FAIL"
        print(f"{status} - {test_name}: {details}")
        
    async def test_health_endpoint(self):
        """Test the health check endpoint"""
        try:
            async with self.session.get(f"{API_BASE_URL}/health") as response:
                if response.status == 200:
                    data = await response.json()
                    
                    # Check required fields
                    required_fields = ['status', 'database_connected', 'gemini_configured', 'timestamp']
                    missing_fields = [field for field in required_fields if field not in data]
                    
                    if missing_fields:
                        self.log_test("Health Check", False, f"Missing fields: {missing_fields}", data)
                        return False
                    
                    # Check Gemini configuration
                    if not data.get('gemini_configured'):
                        self.log_test("Health Check", False, "Gemini API not configured", data)
                        return False
                    
                    # Check database connection
                    if not data.get('database_connected'):
                        self.log_test("Health Check", False, "Database not connected", data)
                        return False
                    
                    self.log_test("Health Check", True, "All systems operational", data)
                    return True
                else:
                    self.log_test("Health Check", False, f"HTTP {response.status}", await response.text())
                    return False
                    
        except Exception as e:
            self.log_test("Health Check", False, f"Request failed: {str(e)}")
            return False
    
    async def test_main_analysis_endpoint(self):
        """Test the main business analysis endpoint"""
        test_data = {
            "business_name": "Wedding Makeover Studio",
            "business_category": "Makeup Artist",
            "location": "New York, NY"
        }
        
        try:
            headers = {'Content-Type': 'application/json'}
            async with self.session.post(
                f"{API_BASE_URL}/analyze-business", 
                json=test_data,
                headers=headers,
                timeout=aiohttp.ClientTimeout(total=120)  # 2 minute timeout for analysis
            ) as response:
                
                if response.status == 200:
                    data = await response.json()
                    
                    # Check response structure
                    if not data.get('success'):
                        self.log_test("Main Analysis", False, "Response indicates failure", data)
                        return False
                    
                    if 'analysis_id' not in data:
                        self.log_test("Main Analysis", False, "Missing analysis_id", data)
                        return False
                    
                    if 'data' not in data:
                        self.log_test("Main Analysis", False, "Missing analysis data", data)
                        return False
                    
                    # Store analysis ID for later tests
                    self.analysis_id = data['analysis_id']
                    
                    # Check analysis data structure
                    analysis_data = data['data']
                    required_sections = [
                        'business_info', 'linkedin_profile', 'tech_stack', 
                        'website_analysis', 'business_intelligence', 'outreach_message'
                    ]
                    
                    missing_sections = [section for section in required_sections if section not in analysis_data]
                    if missing_sections:
                        self.log_test("Main Analysis", False, f"Missing analysis sections: {missing_sections}", data)
                        return False
                    
                    # Check for AI processing results
                    if 'error' in analysis_data.get('business_intelligence', {}):
                        self.log_test("Main Analysis", False, f"AI analysis error: {analysis_data['business_intelligence']['error']}", data)
                        return False
                    
                    if 'error' in analysis_data.get('outreach_message', {}):
                        self.log_test("Main Analysis", False, f"Outreach generation error: {analysis_data['outreach_message']['error']}", data)
                        return False
                    
                    self.log_test("Main Analysis", True, f"Analysis completed successfully (ID: {self.analysis_id})", {
                        'analysis_id': self.analysis_id,
                        'sections_present': list(analysis_data.keys())
                    })
                    return True
                    
                else:
                    error_text = await response.text()
                    self.log_test("Main Analysis", False, f"HTTP {response.status}: {error_text}")
                    return False
                    
        except asyncio.TimeoutError:
            self.log_test("Main Analysis", False, "Request timed out after 2 minutes")
            return False
        except Exception as e:
            self.log_test("Main Analysis", False, f"Request failed: {str(e)}")
            return False
    
    async def test_get_analysis_endpoint(self):
        """Test retrieving analysis by ID"""
        if not self.analysis_id:
            self.log_test("Get Analysis", False, "No analysis ID available from previous test")
            return False
        
        try:
            async with self.session.get(f"{API_BASE_URL}/analysis/{self.analysis_id}") as response:
                if response.status == 200:
                    data = await response.json()
                    
                    if not data.get('success'):
                        self.log_test("Get Analysis", False, "Response indicates failure", data)
                        return False
                    
                    if 'data' not in data:
                        self.log_test("Get Analysis", False, "Missing analysis data", data)
                        return False
                    
                    # Verify it's the same analysis
                    retrieved_id = data['data'].get('analysis_id')
                    if retrieved_id != self.analysis_id:
                        self.log_test("Get Analysis", False, f"ID mismatch: expected {self.analysis_id}, got {retrieved_id}", data)
                        return False
                    
                    self.log_test("Get Analysis", True, f"Successfully retrieved analysis {self.analysis_id}", {
                        'analysis_id': retrieved_id
                    })
                    return True
                    
                elif response.status == 404:
                    self.log_test("Get Analysis", False, "Analysis not found in database")
                    return False
                else:
                    error_text = await response.text()
                    self.log_test("Get Analysis", False, f"HTTP {response.status}: {error_text}")
                    return False
                    
        except Exception as e:
            self.log_test("Get Analysis", False, f"Request failed: {str(e)}")
            return False
    
    async def test_get_all_analyses_endpoint(self):
        """Test retrieving all analyses"""
        try:
            async with self.session.get(f"{API_BASE_URL}/analyses") as response:
                if response.status == 200:
                    data = await response.json()
                    
                    if not data.get('success'):
                        self.log_test("Get All Analyses", False, "Response indicates failure", data)
                        return False
                    
                    if 'data' not in data:
                        self.log_test("Get All Analyses", False, "Missing analyses data", data)
                        return False
                    
                    analyses = data['data']
                    total = data.get('total', len(analyses))
                    
                    # Check if our test analysis is in the list
                    if self.analysis_id:
                        found_test_analysis = any(
                            analysis.get('analysis_id') == self.analysis_id 
                            for analysis in analyses
                        )
                        if not found_test_analysis:
                            self.log_test("Get All Analyses", False, f"Test analysis {self.analysis_id} not found in list", data)
                            return False
                    
                    self.log_test("Get All Analyses", True, f"Retrieved {total} analyses successfully", {
                        'total_analyses': total,
                        'test_analysis_found': bool(self.analysis_id)
                    })
                    return True
                    
                else:
                    error_text = await response.text()
                    self.log_test("Get All Analyses", False, f"HTTP {response.status}: {error_text}")
                    return False
                    
        except Exception as e:
            self.log_test("Get All Analyses", False, f"Request failed: {str(e)}")
            return False
    
    async def test_error_handling(self):
        """Test error handling with invalid inputs"""
        test_cases = [
            {
                'name': 'Empty Business Name',
                'data': {'business_name': '', 'location': 'New York'},
                'expected_error': True
            },
            {
                'name': 'Missing Business Name',
                'data': {'location': 'New York'},
                'expected_error': True
            },
            {
                'name': 'Invalid JSON',
                'data': 'invalid json',
                'expected_error': True
            }
        ]
        
        error_tests_passed = 0
        
        for test_case in test_cases:
            try:
                headers = {'Content-Type': 'application/json'}
                
                if isinstance(test_case['data'], str):
                    # Test invalid JSON
                    async with self.session.post(
                        f"{API_BASE_URL}/analyze-business",
                        data=test_case['data'],
                        headers=headers
                    ) as response:
                        if response.status >= 400:
                            error_tests_passed += 1
                            self.log_test(f"Error Handling - {test_case['name']}", True, f"Correctly returned HTTP {response.status}")
                        else:
                            self.log_test(f"Error Handling - {test_case['name']}", False, f"Should have failed but returned HTTP {response.status}")
                else:
                    # Test invalid data
                    async with self.session.post(
                        f"{API_BASE_URL}/analyze-business",
                        json=test_case['data'],
                        headers=headers
                    ) as response:
                        if response.status >= 400:
                            error_tests_passed += 1
                            self.log_test(f"Error Handling - {test_case['name']}", True, f"Correctly returned HTTP {response.status}")
                        else:
                            self.log_test(f"Error Handling - {test_case['name']}", False, f"Should have failed but returned HTTP {response.status}")
                            
            except Exception as e:
                self.log_test(f"Error Handling - {test_case['name']}", False, f"Test failed: {str(e)}")
        
        overall_success = error_tests_passed == len(test_cases)
        self.log_test("Error Handling Overall", overall_success, f"Passed {error_tests_passed}/{len(test_cases)} error handling tests")
        return overall_success
    
    async def test_invalid_analysis_id(self):
        """Test retrieving analysis with invalid ID"""
        invalid_id = "invalid-analysis-id-12345"
        
        try:
            async with self.session.get(f"{API_BASE_URL}/analysis/{invalid_id}") as response:
                if response.status == 404:
                    self.log_test("Invalid Analysis ID", True, "Correctly returned 404 for invalid ID")
                    return True
                else:
                    self.log_test("Invalid Analysis ID", False, f"Expected 404, got HTTP {response.status}")
                    return False
                    
        except Exception as e:
            self.log_test("Invalid Analysis ID", False, f"Request failed: {str(e)}")
            return False
    
    async def run_all_tests(self):
        """Run all backend tests"""
        print(f"🚀 Starting Backend Tests for AI Business Intelligence Tool")
        print(f"📍 Backend URL: {API_BASE_URL}")
        print(f"⏰ Test started at: {datetime.utcnow().isoformat()}")
        print("=" * 80)
        
        # Test sequence
        tests = [
            ("Health Check", self.test_health_endpoint),
            ("Main Analysis Endpoint", self.test_main_analysis_endpoint),
            ("Get Analysis by ID", self.test_get_analysis_endpoint),
            ("Get All Analyses", self.test_get_all_analyses_endpoint),
            ("Error Handling", self.test_error_handling),
            ("Invalid Analysis ID", self.test_invalid_analysis_id),
        ]
        
        passed_tests = 0
        total_tests = len(tests)
        
        for test_name, test_func in tests:
            print(f"\n🧪 Running: {test_name}")
            try:
                success = await test_func()
                if success:
                    passed_tests += 1
            except Exception as e:
                self.log_test(test_name, False, f"Test execution failed: {str(e)}")
        
        print("\n" + "=" * 80)
        print(f"📊 TEST SUMMARY")
        print(f"✅ Passed: {passed_tests}/{total_tests}")
        print(f"❌ Failed: {total_tests - passed_tests}/{total_tests}")
        print(f"📈 Success Rate: {(passed_tests/total_tests)*100:.1f}%")
        
        # Detailed results
        print(f"\n📋 DETAILED RESULTS:")
        for result in self.test_results:
            status = "✅" if result['success'] else "❌"
            print(f"{status} {result['test_name']}: {result['details']}")
        
        return passed_tests, total_tests, self.test_results

async def main():
    """Main test execution"""
    async with BackendTester() as tester:
        passed, total, results = await tester.run_all_tests()
        
        # Save results to file
        test_report = {
            'test_summary': {
                'passed': passed,
                'total': total,
                'success_rate': (passed/total)*100,
                'timestamp': datetime.utcnow().isoformat()
            },
            'detailed_results': results
        }
        
        with open('/app/backend_test_results.json', 'w') as f:
            json.dump(test_report, f, indent=2, default=str)
        
        print(f"\n💾 Test results saved to: /app/backend_test_results.json")
        
        return passed == total

if __name__ == "__main__":
    success = asyncio.run(main())
    exit(0 if success else 1)