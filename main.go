package main

import (
	"encoding/binary"
	"encoding/json"
	"fmt"
	"io"
	"log"
	"net/http"
	"os"
	"regexp"
	"strings"
	"time"

	"golang.org/x/net/html"
)

// Message structures
type Request struct {
	Action  string                 `json:"action"`
	URL     string                 `json:"url,omitempty"`
	Data    map[string]interface{} `json:"data,omitempty"`
	Options map[string]interface{} `json:"options,omitempty"`
}

type Response struct {
	Success bool                   `json:"success"`
	Data    map[string]interface{} `json:"data,omitempty"`
	Error   string                 `json:"error,omitempty"`
}

type ProductInfo struct {
	Name       string  `json:"name"`
	Price      float64 `json:"price"`
	Currency   string  `json:"currency"`
	URL        string  `json:"url"`
	Site       string  `json:"site"`
	Image      string  `json:"image,omitempty"`
	Confidence float64 `json:"confidence"`
	Method     string  `json:"method"`
}

// Logger setup
var logger *log.Logger

func init() {
	// Log to file for debugging
	logFile, err := os.OpenFile("/tmp/price-tracker-go.log", os.O_CREATE|os.O_WRONLY|os.O_APPEND, 0644)
	if err != nil {
		log.Fatal(err)
	}
	logger = log.New(logFile, "[Go Backend] ", log.LstdFlags)
	logger.Println("🚀 Go backend starting...")
}

func main() {
	logger.Println("✅ Go backend initialized")

	// Native messaging loop
	for {
		// Read message length (4 bytes, little-endian)
		var length uint32
		if err := binary.Read(os.Stdin, binary.LittleEndian, &length); err != nil {
			if err == io.EOF {
				logger.Println("📭 EOF received, exiting")
				break
			}
			logger.Printf("❌ Error reading message length: %v\n", err)
			continue
		}

		if length == 0 || length > 1024*1024 {
			logger.Printf("❌ Invalid message length: %d\n", length)
			continue
		}

		// Read message content
		messageBytes := make([]byte, length)
		if _, err := io.ReadFull(os.Stdin, messageBytes); err != nil {
			logger.Printf("❌ Error reading message: %v\n", err)
			continue
		}

		// Parse request
		var req Request
		if err := json.Unmarshal(messageBytes, &req); err != nil {
			logger.Printf("❌ Error parsing JSON: %v\n", err)
			sendError("Invalid JSON")
			continue
		}

		logger.Printf("📥 Received action: %s\n", req.Action)

		// Handle request
		response := handleRequest(req)

		// Send response
		sendResponse(response)
	}

	logger.Println("👋 Go backend shutting down")
}

// Handle incoming requests
func handleRequest(req Request) Response {
	switch req.Action {
	case "ping":
		return Response{
			Success: true,
			Data: map[string]interface{}{
				"pong":      true,
				"timestamp": time.Now().Unix(),
				"version":   "1.0.0",
			},
		}

	case "fetchPrice":
		if req.URL == "" {
			return Response{Success: false, Error: "URL is required"}
		}
		product, err := fetchProductPrice(req.URL)
		if err != nil {
			return Response{Success: false, Error: err.Error()}
		}
		return Response{
			Success: true,
			Data: map[string]interface{}{
				"product": product,
			},
		}

	case "parseHTML":
		if req.URL == "" {
			return Response{Success: false, Error: "URL is required"}
		}
		html, err := fetchHTML(req.URL)
		if err != nil {
			return Response{Success: false, Error: err.Error()}
		}
		return Response{
			Success: true,
			Data: map[string]interface{}{
				"html": html,
			},
		}

	case "extractWithSelector":
		if req.URL == "" || req.Data == nil || req.Data["selector"] == nil {
			return Response{Success: false, Error: "URL and selector are required"}
		}
		product, err := extractWithSelector(req.URL, req.Data["selector"].(string))
		if err != nil {
			return Response{Success: false, Error: err.Error()}
		}
		return Response{
			Success: true,
			Data: map[string]interface{}{
				"product": product,
			},
		}

	case "checkMultipleProducts":
		if req.Data == nil || req.Data["products"] == nil {
			return Response{Success: false, Error: "Products array is required"}
		}
		results := checkMultipleProducts(req.Data["products"].([]interface{}))
		return Response{
			Success: true,
			Data: map[string]interface{}{
				"results": results,
			},
		}

	default:
		return Response{Success: false, Error: fmt.Sprintf("Unknown action: %s", req.Action)}
	}
}

// Fetch product price from URL
func fetchProductPrice(urlStr string) (*ProductInfo, error) {
	logger.Printf("🔍 Fetching price from: %s\n", urlStr)

	// Fetch HTML
	html, err := fetchHTML(urlStr)
	if err != nil {
		return nil, err
	}

	// Parse HTML
	doc, err := parseHTML(strings.NewReader(html))
	if err != nil {
		return nil, err
	}

	// Extract product info
	product := extractProductInfo(doc, urlStr)
	if product == nil {
		return nil, fmt.Errorf("no product found")
	}

	logger.Printf("✅ Product found: %s - %.2f %s\n", product.Name, product.Price, product.Currency)
	return product, nil
}

// Extract product with custom selector
func extractWithSelector(urlStr, selector string) (*ProductInfo, error) {
	logger.Printf("🎯 Extracting with selector: %s from %s\n", selector, urlStr)

	html, err := fetchHTML(urlStr)
	if err != nil {
		return nil, err
	}

	doc, err := parseHTML(strings.NewReader(html))
	if err != nil {
		return nil, err
	}

	// Simple selector matching (you can use goquery for better CSS selector support)
	text := extractTextBySelector(doc, selector)
	if text == "" {
		return nil, fmt.Errorf("selector not found or empty")
	}

	// Extract price from text
	price := extractPriceFromText(text)
	if price == 0 {
		return nil, fmt.Errorf("no price found in selected element")
	}

	// Get product name
	name := extractProductName(doc)

	return &ProductInfo{
		Name:       name,
		Price:      price,
		Currency:   "TRY",
		URL:        urlStr,
		Site:       getSiteName(urlStr),
		Confidence: 0.95,
		Method:     "custom-selector-go",
	}, nil
}

// Check multiple products concurrently
func checkMultipleProducts(products []interface{}) []map[string]interface{} {
	logger.Printf("🔄 Checking %d products concurrently\n", len(products))

	results := make([]map[string]interface{}, len(products))
	done := make(chan bool)

	for i, p := range products {
		go func(index int, product interface{}) {
			productMap := product.(map[string]interface{})
			url := productMap["url"].(string)

			result := map[string]interface{}{
				"index":   index,
				"url":     url,
				"success": false,
			}

			if prod, err := fetchProductPrice(url); err == nil {
				result["success"] = true
				result["product"] = prod
			} else {
				result["error"] = err.Error()
			}

			results[index] = result
			done <- true
		}(i, p)
	}

	// Wait for all goroutines
	for i := 0; i < len(products); i++ {
		<-done
	}

	return results
}

// Fetch HTML from URL
func fetchHTML(urlStr string) (string, error) {
	client := &http.Client{
		Timeout: 15 * time.Second,
	}

	req, err := http.NewRequest("GET", urlStr, nil)
	if err != nil {
		return "", err
	}

	req.Header.Set("User-Agent", "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36")
	req.Header.Set("Accept", "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8")
	req.Header.Set("Accept-Language", "tr-TR,tr;q=0.9,en-US;q=0.8,en;q=0.7")

	resp, err := client.Do(req)
	if err != nil {
		return "", err
	}
	defer resp.Body.Close()

	if resp.StatusCode != 200 {
		return "", fmt.Errorf("HTTP %d", resp.StatusCode)
	}

	body, err := io.ReadAll(resp.Body)
	if err != nil {
		return "", err
	}

	return string(body), nil
}

// Parse HTML string to document
func parseHTML(r io.Reader) (*html.Node, error) {
	return html.Parse(r)
}

// Extract product info from HTML document
func extractProductInfo(doc *html.Node, urlStr string) *ProductInfo {
	// Try schema.org first
	if product := extractFromSchema(doc, urlStr); product != nil {
		return product
	}

	// Try common price patterns
	if product := extractWithPatterns(doc, urlStr); product != nil {
		return product
	}

	return nil
}

// Extract from schema.org microdata
func extractFromSchema(doc *html.Node, urlStr string) *ProductInfo {
	var price float64
	var name string

	var findSchema func(*html.Node)
	findSchema = func(n *html.Node) {
		if n.Type == html.ElementNode {
			for _, attr := range n.Attr {
				if attr.Key == "itemprop" {
					if attr.Val == "price" {
						price = extractPriceFromText(getTextContent(n))
					} else if attr.Val == "name" {
						name = getTextContent(n)
					}
				}
			}
		}

		for c := n.FirstChild; c != nil; c = c.NextSibling {
			findSchema(c)
		}
	}

	findSchema(doc)

	if price > 0 && name != "" {
		return &ProductInfo{
			Name:       name,
			Price:      price,
			Currency:   "TRY",
			URL:        urlStr,
			Site:       getSiteName(urlStr),
			Confidence: 0.85,
			Method:     "schema.org-go",
		}
	}

	return nil
}

// Extract with common patterns
func extractWithPatterns(doc *html.Node, urlStr string) *ProductInfo {
	// Find elements with price-related classes
	var price float64
	var name string

	var findPrice func(*html.Node)
	findPrice = func(n *html.Node) {
		if n.Type == html.ElementNode {
			class := getAttr(n, "class")
			if strings.Contains(class, "price") || strings.Contains(class, "fiyat") {
				text := getTextContent(n)
				if p := extractPriceFromText(text); p > 0 {
					price = p
				}
			}
		}

		for c := n.FirstChild; c != nil; c = c.NextSibling {
			if price == 0 {
				findPrice(c)
			}
		}
	}

	findPrice(doc)

	// Find product name from h1
	var findName func(*html.Node)
	findName = func(n *html.Node) {
		if n.Type == html.ElementNode && n.Data == "h1" {
			name = getTextContent(n)
		}
		for c := n.FirstChild; c != nil; c = c.NextSibling {
			if name == "" {
				findName(c)
			}
		}
	}

	findName(doc)

	if price > 0 && name != "" {
		return &ProductInfo{
			Name:       name,
			Price:      price,
			Currency:   "TRY",
			URL:        urlStr,
			Site:       getSiteName(urlStr),
			Confidence: 0.7,
			Method:     "pattern-go",
		}
	}

	return nil
}

// Extract price from text
func extractPriceFromText(text string) float64 {
	// Remove currency symbols and clean
	text = strings.ReplaceAll(text, "₺", "")
	text = strings.ReplaceAll(text, "TL", "")
	text = strings.ReplaceAll(text, "TRY", "")
	text = strings.TrimSpace(text)

	// Match number patterns
	re := regexp.MustCompile(`(\d{1,3}(?:[.,]\d{3})*(?:[.,]\d{1,2})?|\d+(?:[.,]\d{1,2})?)`)
	matches := re.FindStringSubmatch(text)
	if len(matches) == 0 {
		return 0
	}

	priceStr := matches[1]
	// Handle Turkish format: 1.234,56 -> 1234.56
	if strings.Contains(priceStr, ",") {
		priceStr = strings.ReplaceAll(priceStr, ".", "")
		priceStr = strings.ReplaceAll(priceStr, ",", ".")
	}

	var price float64
	fmt.Sscanf(priceStr, "%f", &price)
	return price
}

// Extract product name from document
func extractProductName(doc *html.Node) string {
	var name string
	var findH1 func(*html.Node)
	findH1 = func(n *html.Node) {
		if n.Type == html.ElementNode && n.Data == "h1" {
			name = getTextContent(n)
		}
		for c := n.FirstChild; c != nil; c = c.NextSibling {
			if name == "" {
				findH1(c)
			}
		}
	}
	findH1(doc)
	return name
}

// Extract text by selector (basic implementation)
func extractTextBySelector(doc *html.Node, selector string) string {
	// This is a simplified selector matcher
	// For production, use github.com/PuerkitoBio/goquery
	var result string
	var find func(*html.Node)
	find = func(n *html.Node) {
		if n.Type == html.ElementNode {
			class := getAttr(n, "class")
			id := getAttr(n, "id")

			// Simple class/id matching
			if strings.Contains(selector, ".") && strings.Contains(class, strings.TrimPrefix(selector, ".")) {
				result = getTextContent(n)
				return
			}
			if strings.Contains(selector, "#") && strings.Contains(id, strings.TrimPrefix(selector, "#")) {
				result = getTextContent(n)
				return
			}
		}

		for c := n.FirstChild; c != nil; c = c.NextSibling {
			if result == "" {
				find(c)
			}
		}
	}

	find(doc)
	return result
}

// Get text content of node
func getTextContent(n *html.Node) string {
	if n.Type == html.TextNode {
		return n.Data
	}
	var text string
	for c := n.FirstChild; c != nil; c = c.NextSibling {
		text += getTextContent(c)
	}
	return strings.TrimSpace(text)
}

// Get attribute value
func getAttr(n *html.Node, key string) string {
	for _, attr := range n.Attr {
		if attr.Key == key {
			return attr.Val
		}
	}
	return ""
}

// Get site name from URL
func getSiteName(urlStr string) string {
	parts := strings.Split(urlStr, "/")
	if len(parts) > 2 {
		domain := strings.Replace(parts[2], "www.", "", 1)
		return strings.Title(strings.Split(domain, ".")[0])
	}
	return "Unknown"
}

// Send response to Firefox
func sendResponse(resp Response) {
	responseBytes, err := json.Marshal(resp)
	if err != nil {
		logger.Printf("❌ Error marshaling response: %v\n", err)
		return
	}

	length := uint32(len(responseBytes))

	// Write message length
	if err := binary.Write(os.Stdout, binary.LittleEndian, length); err != nil {
		logger.Printf("❌ Error writing response length: %v\n", err)
		return
	}

	// Write message content
	if _, err := os.Stdout.Write(responseBytes); err != nil {
		logger.Printf("❌ Error writing response: %v\n", err)
		return
	}

	logger.Printf("📤 Sent response: %s\n", string(responseBytes))
}

// Send error response
func sendError(message string) {
	sendResponse(Response{
		Success: false,
		Error:   message,
	})
}
