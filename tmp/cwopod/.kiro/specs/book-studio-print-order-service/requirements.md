# Requirements Document

## Introduction

The Print & Order Service module integrates C.W.'s O-POD with print-on-demand providers to enable users to order physical copies of their books directly from the application. It supports multiple providers (Lulu xPress, BookVault, KDP Print), handles pricing estimates, order submission with retry logic, ISBN management, and secure credential storage. The module bridges the gap between the completed book assets (interior PDF + cover PDF) and the physical printing process, providing a streamlined ordering experience.

## Glossary

- **Print_Service_Integrator**: The module that interfaces with print-on-demand providers for pricing, ISBN management, and order submission
- **Print_Provider**: An external print-on-demand service (Lulu xPress, BookVault, or KDP Print)
- **PrintProviderAdapter**: Abstract interface defining the contract for all provider integrations
- **LuluAdapter**: Implementation of PrintProviderAdapter for Lulu xPress API
- **BookVaultAdapter**: Implementation of PrintProviderAdapter for BookVault API
- **KDPAdapter**: Implementation of PrintProviderAdapter for KDP Print (file generation only, no API submission)
- **ISBNManager**: Component responsible for ISBN validation, Lulu free ISBN requests, and ISBN toggle management
- **PrintOrder**: Database model representing a submitted print order
- **OrderItem**: Database model representing an individual book within a print order
- **Fernet_Encryption**: Symmetric encryption scheme used for storing provider API credentials at rest

## Requirements

### Requirement 1: Provider Support

**User Story:** As a user, I want to choose from multiple print-on-demand providers, so that I can select the best option for my location, pricing, and distribution needs.

#### Acceptance Criteria

1.1 THE Print_Service_Integrator SHALL support Lulu xPress, BookVault, and KDP Print as Print_Providers

1.2 THE Print_Service_Integrator SHALL allow each user to set a default Print_Provider that is pre-selected for new orders

1.3 THE Print_Service_Integrator SHALL allow the default Print_Provider to be overridden on a per-book basis at order time

1.4 THE Print_Service_Integrator SHALL implement each provider as a separate adapter conforming to a common interface, allowing new providers to be added without modifying the ordering logic

### Requirement 2: Credential Management

**User Story:** As a user, I want to securely store my API credentials for each print provider, so that I can submit orders without re-entering credentials each time.

#### Acceptance Criteria

2.1 THE Print_Service_Integrator SHALL allow each user to store API credentials for each Print_Provider

2.2 THE Print_Service_Integrator SHALL encrypt all stored credentials using Fernet symmetric encryption derived from the application SECRET_KEY and a per-user salt

2.3 THE Print_Service_Integrator SHALL decrypt credentials only at the moment of use for an API request and SHALL NOT log or cache decrypted credentials

2.4 THE Print_Service_Integrator SHALL ensure one user cannot access another user's stored credentials through any interface or API endpoint

2.5 THE Print_Service_Integrator SHALL allow users to update or delete stored credentials for any provider

### Requirement 3: Print Readiness

**User Story:** As a user, I want the system to verify my book is ready for printing before allowing me to order, so that I don't submit incomplete files to the printer.

#### Acceptance Criteria

3.1 WHEN a book project has both a valid interior PDF and a valid cover PDF generated, THE Print_Service_Integrator SHALL consider the book ready for printing and enable the print submission workflow

3.2 IF a book project is missing either a valid interior PDF or a valid cover PDF, THEN THE Print_Service_Integrator SHALL disable the print submission workflow and display a message indicating which files are missing

### Requirement 4: Pricing Estimates

**User Story:** As a user, I want to see pricing estimates before committing to an order, so that I can make informed decisions about printing costs.

#### Acceptance Criteria

4.1 WHEN a book is ready for printing, THE Print_Service_Integrator SHALL display pricing estimates from the selected Print_Provider before the user commits to an order

4.2 THE pricing estimate SHALL include at minimum: unit printing cost, shipping cost, and total estimated cost

4.3 IF pricing estimate retrieval fails or does not respond within 30 seconds, THEN THE Print_Service_Integrator SHALL display an error message indicating the reason for failure and allow the user to retry or select a different Print_Provider

### Requirement 5: Order Submission (Lulu xPress and BookVault)

**User Story:** As a user, I want to submit print orders directly through the application, so that I can order physical copies without manual file handling.

#### Acceptance Criteria

5.1 WHEN Lulu xPress is selected and the user confirms the order, THE Print_Service_Integrator SHALL submit the order via Lulu's API and display a confirmation including the provider's order identifier upon success

5.2 WHEN BookVault is selected and the user confirms the order, THE Print_Service_Integrator SHALL submit the order via BookVault's API and display a confirmation including the provider's order identifier upon success

5.3 THE LuluAdapter SHALL support multi-title orders (multiple books in a single order)

5.4 THE BookVaultAdapter SHALL submit single-title orders (one book per API call)

5.5 IF an order submission fails, THEN THE Print_Service_Integrator SHALL display the error details and allow the user to retry up to 3 attempts or select a different Print_Provider

5.6 THE Print_Service_Integrator SHALL implement automatic retry with exponential backoff for transient failures (network timeouts, 5xx errors), up to a maximum of 3 attempts per submission

### Requirement 6: KDP Print Handling

**User Story:** As a user, I want to use KDP Print for my books even though it doesn't have a submission API, so that I can access Amazon's distribution network.

#### Acceptance Criteria

6.1 WHEN KDP Print is selected, THE Print_Service_Integrator SHALL generate the required files (interior PDF, cover PDF) packaged for KDP upload

6.2 WHEN KDP Print is selected, THE Print_Service_Integrator SHALL provide step-by-step instructions for manual upload to KDP's web interface

6.3 THE KDPAdapter SHALL NOT attempt API submission and SHALL clearly indicate to the user that manual upload is required

### Requirement 7: ISBN Management

**User Story:** As a user, I want to optionally assign an ISBN to my book through various methods, so that I can have a formally cataloged publication when desired.

#### Acceptance Criteria

7.1 THE Print_Service_Integrator SHALL provide an optional ISBN toggle for each book project

7.2 WHEN no ISBN option is selected (toggle off), THE Print_Service_Integrator SHALL proceed without an ISBN

7.3 WHERE ISBN is enabled and the user selects Lulu's free ISBN program, THE Print_Service_Integrator SHALL request and assign an ISBN through Lulu's API and display the assigned ISBN to the user upon successful assignment

7.4 WHERE ISBN is enabled and the user provides their own ISBN, THE Print_Service_Integrator SHALL validate that the supplied ISBN conforms to ISBN-13 format (13 digits with valid check digit) before accepting it

7.5 IF the user provides an ISBN that does not conform to ISBN-13 format, THEN THE Print_Service_Integrator SHALL reject the input, display an error message indicating the format requirement, and retain the user's entered value for correction

7.6 IF the Lulu API ISBN request fails or does not respond within 30 seconds, THEN THE Print_Service_Integrator SHALL display an error message indicating the ISBN could not be obtained and allow the user to retry or proceed without an ISBN

### Requirement 8: Order Tracking

**User Story:** As a user, I want to view the status of my print orders, so that I can track my books from submission to delivery.

#### Acceptance Criteria

8.1 THE Print_Service_Integrator SHALL store all submitted orders with their provider order ID, status, and associated book project

8.2 THE Print_Service_Integrator SHALL allow users to view a list of all their orders with current status

8.3 THE Print_Service_Integrator SHALL allow users to view details of a specific order including items, pricing, and provider status

8.4 THE Print_Service_Integrator SHALL support the following order statuses: pending, submitted, printing, shipped, delivered, failed

### Requirement 9: Error Handling

**User Story:** As a user, I want clear error messages when something goes wrong with printing, so that I can understand and resolve issues.

#### Acceptance Criteria

9.1 IF a pricing estimate request fails, THEN THE Print_Service_Integrator SHALL display the failure reason and offer retry or provider switch options

9.2 IF an order submission fails after all retry attempts are exhausted, THEN THE Print_Service_Integrator SHALL display the error details, preserve the order in "failed" status, and allow the user to retry manually or select a different provider

9.3 IF an ISBN request to Lulu's API fails or times out after 30 seconds, THEN THE Print_Service_Integrator SHALL display an error and allow the user to retry or proceed without an ISBN

9.4 THE Print_Service_Integrator SHALL enforce a 30-second timeout on all external API calls (pricing, submission, ISBN requests) and report timeout errors clearly to the user
